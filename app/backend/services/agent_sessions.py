import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_sessions import Agent_sessions

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Agent_sessionsService:
    """Service layer for Agent_sessions operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Agent_sessions]:
        """Create a new agent_sessions"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Agent_sessions(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created agent_sessions with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating agent_sessions: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for agent_sessions {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Agent_sessions]:
        """Get agent_sessions by ID (user can only see their own records)"""
        try:
            query = select(Agent_sessions).where(Agent_sessions.id == obj_id)
            if user_id:
                query = query.where(Agent_sessions.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching agent_sessions {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of agent_sessionss (user can only see their own records)"""
        try:
            query = select(Agent_sessions)
            count_query = select(func.count(Agent_sessions.id))
            
            if user_id:
                query = query.where(Agent_sessions.user_id == user_id)
                count_query = count_query.where(Agent_sessions.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Agent_sessions, field):
                        query = query.where(getattr(Agent_sessions, field) == value)
                        count_query = count_query.where(getattr(Agent_sessions, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Agent_sessions, field_name):
                        query = query.order_by(getattr(Agent_sessions, field_name).desc())
                else:
                    if hasattr(Agent_sessions, sort):
                        query = query.order_by(getattr(Agent_sessions, sort))
            else:
                query = query.order_by(Agent_sessions.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching agent_sessions list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Agent_sessions]:
        """Update agent_sessions (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Agent_sessions {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated agent_sessions {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating agent_sessions {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete agent_sessions (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Agent_sessions {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted agent_sessions {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting agent_sessions {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Agent_sessions]:
        """Get agent_sessions by any field"""
        try:
            if not hasattr(Agent_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Agent_sessions")
            result = await self.db.execute(
                select(Agent_sessions).where(getattr(Agent_sessions, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching agent_sessions by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Agent_sessions]:
        """Get list of agent_sessionss filtered by field"""
        try:
            if not hasattr(Agent_sessions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Agent_sessions")
            result = await self.db.execute(
                select(Agent_sessions)
                .where(getattr(Agent_sessions, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Agent_sessions.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching agent_sessionss by {field_name}: {str(e)}")
            raise
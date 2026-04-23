import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.apps import AppsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/apps", tags=["apps"])


# ---------- Pydantic Schemas ----------
class AppsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None
    status: str = None
    agent_mode: str = None
    thumbnail: str = None


class AppsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    agent_mode: Optional[str] = None
    thumbnail: Optional[str] = None


class AppsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    status: Optional[str] = None
    agent_mode: Optional[str] = None
    thumbnail: Optional[str] = None

    class Config:
        from_attributes = True


class AppsListResponse(BaseModel):
    """List response schema"""
    items: List[AppsResponse]
    total: int
    skip: int
    limit: int


class AppsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[AppsData]


class AppsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: AppsUpdateData


class AppsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[AppsBatchUpdateItem]


class AppsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=AppsListResponse)
async def query_appss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query appss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying appss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = AppsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} appss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying appss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=AppsListResponse)
async def query_appss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query appss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying appss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = AppsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} appss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying appss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=AppsResponse)
async def get_apps(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single apps by ID (user can only see their own records)"""
    logger.debug(f"Fetching apps with id: {id}, fields={fields}")
    
    service = AppsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Apps with id {id} not found")
            raise HTTPException(status_code=404, detail="Apps not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=AppsResponse, status_code=201)
async def create_apps(
    data: AppsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new apps"""
    logger.debug(f"Creating new apps with data: {data}")
    
    service = AppsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create apps")
        
        logger.info(f"Apps created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating apps: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating apps: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[AppsResponse], status_code=201)
async def create_appss_batch(
    request: AppsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple appss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} appss")
    
    service = AppsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} appss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[AppsResponse])
async def update_appss_batch(
    request: AppsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple appss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} appss")
    
    service = AppsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} appss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=AppsResponse)
async def update_apps(
    id: int,
    data: AppsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing apps (requires ownership)"""
    logger.debug(f"Updating apps {id} with data: {data}")

    service = AppsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Apps with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Apps not found")
        
        logger.info(f"Apps {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating apps {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_appss_batch(
    request: AppsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple appss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} appss")
    
    service = AppsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} appss successfully")
        return {"message": f"Successfully deleted {deleted_count} appss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_apps(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single apps by ID (requires ownership)"""
    logger.debug(f"Deleting apps with id: {id}")
    
    service = AppsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Apps with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Apps not found")
        
        logger.info(f"Apps {id} deleted successfully")
        return {"message": "Apps deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting apps {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
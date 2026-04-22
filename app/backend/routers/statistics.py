import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.statistics import StatisticsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/statistics", tags=["statistics"])


# ---------- Pydantic Schemas ----------
class StatisticsData(BaseModel):
    """Entity data schema (for create/update)"""
    app_id: int = None
    metric_type: str
    metric_value: int


class StatisticsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    app_id: Optional[int] = None
    metric_type: Optional[str] = None
    metric_value: Optional[int] = None


class StatisticsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    app_id: Optional[int] = None
    metric_type: str
    metric_value: int

    class Config:
        from_attributes = True


class StatisticsListResponse(BaseModel):
    """List response schema"""
    items: List[StatisticsResponse]
    total: int
    skip: int
    limit: int


class StatisticsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[StatisticsData]


class StatisticsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: StatisticsUpdateData


class StatisticsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[StatisticsBatchUpdateItem]


class StatisticsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=StatisticsListResponse)
async def query_statisticss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query statisticss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying statisticss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = StatisticsService(db)
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
        logger.debug(f"Found {result['total']} statisticss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying statisticss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=StatisticsListResponse)
async def query_statisticss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query statisticss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying statisticss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = StatisticsService(db)
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
        logger.debug(f"Found {result['total']} statisticss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying statisticss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=StatisticsResponse)
async def get_statistics(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single statistics by ID (user can only see their own records)"""
    logger.debug(f"Fetching statistics with id: {id}, fields={fields}")
    
    service = StatisticsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Statistics with id {id} not found")
            raise HTTPException(status_code=404, detail="Statistics not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching statistics {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=StatisticsResponse, status_code=201)
async def create_statistics(
    data: StatisticsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new statistics"""
    logger.debug(f"Creating new statistics with data: {data}")
    
    service = StatisticsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create statistics")
        
        logger.info(f"Statistics created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating statistics: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating statistics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[StatisticsResponse], status_code=201)
async def create_statisticss_batch(
    request: StatisticsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple statisticss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} statisticss")
    
    service = StatisticsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} statisticss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[StatisticsResponse])
async def update_statisticss_batch(
    request: StatisticsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple statisticss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} statisticss")
    
    service = StatisticsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} statisticss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=StatisticsResponse)
async def update_statistics(
    id: int,
    data: StatisticsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing statistics (requires ownership)"""
    logger.debug(f"Updating statistics {id} with data: {data}")

    service = StatisticsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Statistics with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Statistics not found")
        
        logger.info(f"Statistics {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating statistics {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating statistics {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_statisticss_batch(
    request: StatisticsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple statisticss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} statisticss")
    
    service = StatisticsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} statisticss successfully")
        return {"message": f"Successfully deleted {deleted_count} statisticss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_statistics(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single statistics by ID (requires ownership)"""
    logger.debug(f"Deleting statistics with id: {id}")
    
    service = StatisticsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Statistics with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Statistics not found")
        
        logger.info(f"Statistics {id} deleted successfully")
        return {"message": "Statistics deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting statistics {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
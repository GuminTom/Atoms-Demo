import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.deployments import DeploymentsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/deployments", tags=["deployments"])


# ---------- Pydantic Schemas ----------
class DeploymentsData(BaseModel):
    """Entity data schema (for create/update)"""
    app_id: int
    status: str = None
    url: str = None
    version: str = None
    environment: str = None
    logs: str = None


class DeploymentsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    app_id: Optional[int] = None
    status: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    environment: Optional[str] = None
    logs: Optional[str] = None


class DeploymentsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    app_id: int
    status: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    environment: Optional[str] = None
    logs: Optional[str] = None

    class Config:
        from_attributes = True


class DeploymentsListResponse(BaseModel):
    """List response schema"""
    items: List[DeploymentsResponse]
    total: int
    skip: int
    limit: int


class DeploymentsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[DeploymentsData]


class DeploymentsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: DeploymentsUpdateData


class DeploymentsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[DeploymentsBatchUpdateItem]


class DeploymentsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=DeploymentsListResponse)
async def query_deploymentss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query deploymentss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying deploymentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = DeploymentsService(db)
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
        logger.debug(f"Found {result['total']} deploymentss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying deploymentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=DeploymentsListResponse)
async def query_deploymentss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query deploymentss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying deploymentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = DeploymentsService(db)
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
        logger.debug(f"Found {result['total']} deploymentss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying deploymentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=DeploymentsResponse)
async def get_deployments(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single deployments by ID (user can only see their own records)"""
    logger.debug(f"Fetching deployments with id: {id}, fields={fields}")
    
    service = DeploymentsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Deployments with id {id} not found")
            raise HTTPException(status_code=404, detail="Deployments not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching deployments {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=DeploymentsResponse, status_code=201)
async def create_deployments(
    data: DeploymentsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new deployments"""
    logger.debug(f"Creating new deployments with data: {data}")
    
    service = DeploymentsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create deployments")
        
        logger.info(f"Deployments created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating deployments: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating deployments: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[DeploymentsResponse], status_code=201)
async def create_deploymentss_batch(
    request: DeploymentsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple deploymentss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} deploymentss")
    
    service = DeploymentsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} deploymentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[DeploymentsResponse])
async def update_deploymentss_batch(
    request: DeploymentsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple deploymentss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} deploymentss")
    
    service = DeploymentsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} deploymentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=DeploymentsResponse)
async def update_deployments(
    id: int,
    data: DeploymentsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing deployments (requires ownership)"""
    logger.debug(f"Updating deployments {id} with data: {data}")

    service = DeploymentsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Deployments with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Deployments not found")
        
        logger.info(f"Deployments {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating deployments {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating deployments {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_deploymentss_batch(
    request: DeploymentsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple deploymentss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} deploymentss")
    
    service = DeploymentsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} deploymentss successfully")
        return {"message": f"Successfully deleted {deleted_count} deploymentss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_deployments(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single deployments by ID (requires ownership)"""
    logger.debug(f"Deleting deployments with id: {id}")
    
    service = DeploymentsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Deployments with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Deployments not found")
        
        logger.info(f"Deployments {id} deleted successfully")
        return {"message": "Deployments deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting deployments {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
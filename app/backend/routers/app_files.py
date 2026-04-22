import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.app_files import App_filesService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/app_files", tags=["app_files"])


# ---------- Pydantic Schemas ----------
class App_filesData(BaseModel):
    """Entity data schema (for create/update)"""
    app_id: int
    path: str
    content: str = None
    language: str = None


class App_filesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    app_id: Optional[int] = None
    path: Optional[str] = None
    content: Optional[str] = None
    language: Optional[str] = None


class App_filesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    app_id: int
    path: str
    content: Optional[str] = None
    language: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class App_filesListResponse(BaseModel):
    """List response schema"""
    items: List[App_filesResponse]
    total: int
    skip: int
    limit: int


class App_filesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[App_filesData]


class App_filesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: App_filesUpdateData


class App_filesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[App_filesBatchUpdateItem]


class App_filesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=App_filesListResponse)
async def query_app_filess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query app_filess with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying app_filess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = App_filesService(db)
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
        logger.debug(f"Found {result['total']} app_filess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying app_filess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=App_filesListResponse)
async def query_app_filess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query app_filess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying app_filess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = App_filesService(db)
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
        logger.debug(f"Found {result['total']} app_filess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying app_filess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=App_filesResponse)
async def get_app_files(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single app_files by ID (user can only see their own records)"""
    logger.debug(f"Fetching app_files with id: {id}, fields={fields}")
    
    service = App_filesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"App_files with id {id} not found")
            raise HTTPException(status_code=404, detail="App_files not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching app_files {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=App_filesResponse, status_code=201)
async def create_app_files(
    data: App_filesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new app_files"""
    logger.debug(f"Creating new app_files with data: {data}")
    
    service = App_filesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create app_files")
        
        logger.info(f"App_files created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating app_files: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating app_files: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[App_filesResponse], status_code=201)
async def create_app_filess_batch(
    request: App_filesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple app_filess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} app_filess")
    
    service = App_filesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} app_filess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[App_filesResponse])
async def update_app_filess_batch(
    request: App_filesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple app_filess in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} app_filess")
    
    service = App_filesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} app_filess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=App_filesResponse)
async def update_app_files(
    id: int,
    data: App_filesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing app_files (requires ownership)"""
    logger.debug(f"Updating app_files {id} with data: {data}")

    service = App_filesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"App_files with id {id} not found for update")
            raise HTTPException(status_code=404, detail="App_files not found")
        
        logger.info(f"App_files {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating app_files {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating app_files {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_app_filess_batch(
    request: App_filesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple app_filess by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} app_filess")
    
    service = App_filesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} app_filess successfully")
        return {"message": f"Successfully deleted {deleted_count} app_filess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_app_files(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single app_files by ID (requires ownership)"""
    logger.debug(f"Deleting app_files with id: {id}")
    
    service = App_filesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"App_files with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="App_files not found")
        
        logger.info(f"App_files {id} deleted successfully")
        return {"message": "App_files deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting app_files {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
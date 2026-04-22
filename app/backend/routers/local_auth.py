import logging

from fastapi import APIRouter, Depends, HTTPException, status
from schemas.local_auth import LocalAuthResponse, LocalUserResponse, LoginRequest, RegisterRequest
from services.auth import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/local-auth", tags=["Local Authentication"])


@router.post("/register", response_model=LocalAuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with username and password."""
    auth_service = AuthService(db)
    try:
        local_user, token = await auth_service.register_local_user(
            username=request.username,
            email=request.email,
            password=request.password,
            name=request.name,
        )
        return LocalAuthResponse(
            token=token,
            user=LocalUserResponse(
                id=local_user.id,
                username=local_user.username,
                email=local_user.email,
                name=local_user.name,
                role=local_user.role,
                last_login=local_user.last_login,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Registration configuration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration is currently unavailable",
        )


@router.post("/login", response_model=LocalAuthResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate a user with username/email and password."""
    auth_service = AuthService(db)
    try:
        local_user, token = await auth_service.login_local_user(
            username=request.username,
            password=request.password,
        )
        return LocalAuthResponse(
            token=token,
            user=LocalUserResponse(
                id=local_user.id,
                username=local_user.username,
                email=local_user.email,
                name=local_user.name,
                role=local_user.role,
                last_login=local_user.last_login,
            ),
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    except RuntimeError as e:
        logger.error(f"Login configuration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login is currently unavailable",
        )
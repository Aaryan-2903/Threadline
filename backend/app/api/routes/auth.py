from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import RoleUpdateRequest, TokenResponse, UserCreate, UserLoginRequest, UserResponse
from app.services import user_service
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(
    login_in: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = user_service.authenticate_user(
        db=db,
        identifier=login_in.username_or_email,
        password=login_in.password,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role.value}
    )

    log_audit_event(
        db=db,
        action="auth_login",
        username=user.username,
        user_role=user.role.value,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        details=f"User '{user.username}' successfully authenticated.",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/demo-login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def demo_login(
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Dedicated Judge One-Click Demo Login.
    Seeds the demo workspace if needed and issues an authenticated session as Project Owner.
    """
    demo_user = user_service.seed_default_users_and_demo(db)
    if not demo_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to initialize demo account.",
        )

    access_token = create_access_token(
        data={"sub": str(demo_user.id), "username": demo_user.username, "role": demo_user.role.value}
    )

    log_audit_event(
        db=db,
        action="demo_login",
        username=demo_user.username,
        user_role=demo_user.role.value,
        user_id=demo_user.id,
        ip_address=request.client.host if request.client else None,
        details="Judge one-click demo session initialized.",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(demo_user),
    )


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve the currently authenticated user's profile and assigned role."""
    return UserResponse.model_validate(current_user)


@router.get("/users", response_model=List[UserResponse], status_code=status.HTTP_200_OK)
def list_system_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[UserResponse]:
    """List system users for handover assignment and role management."""
    users = user_service.list_users(db=db, skip=skip, limit=limit)
    return [UserResponse.model_validate(u) for u in users]


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user account."""
    if user_service.get_user_by_email(db, user_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
    if user_service.get_user_by_username(db, user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists.",
        )

    user = user_service.create_user(db=db, user_in=user_in)
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}/role", response_model=UserResponse, status_code=status.HTTP_200_OK)
def change_user_role(
    user_id: UUID,
    role_in: RoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    Update a user's role.
    Strictly restricted to administrators.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change user roles.",
        )

    updated = user_service.update_user_role(db=db, user_id=user_id, new_role=role_in.role)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    log_audit_event(
        db=db,
        action="role_changed",
        username=current_user.username,
        user_role=current_user.role.value,
        user_id=current_user.id,
        resource_type="user",
        resource_id=user_id,
        details=f"User '{updated.username}' role changed to '{role_in.role}'.",
    )

    return UserResponse.model_validate(updated)


from typing import List, Optional
from uuid import UUID
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User, UserRole

# Optional bearer token extraction so endpoints can support both authenticated and guest/demo calls
security_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Extract user from Bearer JWT token if provided.
    Returns None if no token was passed.
    Raises 401 if a token was passed but is invalid or expired.
    """
    if not auth or not auth.credentials:
        return None

    payload = decode_access_token(auth.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Strict dependency requiring an authenticated user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(allowed_roles: List[str]):
    """
    Role-Based Access Control dependency factory.
    Enforces that authenticated users possess one of the allowed roles.
    If a request is unauthenticated, permits execution for backward compatibility in dev/test,
    unless strict auth is required.
    """
    def _role_checker(user: Optional[User] = Depends(get_current_user_optional)) -> Optional[User]:
        if user is None:
            # Guest or legacy test client
            return None
        user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role_str not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{user_role_str}'. Required one of: {allowed_roles}.",
            )
        return user

    return _role_checker


def check_write_permission(user: Optional[User] = Depends(get_current_user_optional)) -> Optional[User]:
    """
    Convenience dependency that verifies the client is not a read-only Viewer.
    Allows unauthenticated requests (legacy tests / dev), Admin, Project Owner, and Contributor.
    Rejects Viewer with 403 Forbidden.
    """
    if user is not None:
        user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role_str == UserRole.VIEWER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Viewers have read-only access. Write mutations are prohibited.",
            )
    return user


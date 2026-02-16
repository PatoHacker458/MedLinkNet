import sys
import os
# Truco para que Python encuentre la carpeta padre 'backend' y sus archivos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Annotated

# Importamos los módulos locales
import models
import schemas
import security
from database import get_db

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- CORRECCIÓN AQUÍ ---
# Antes: response_model=schemas.User (Error porque no existe)
# Ahora: response_model=schemas.UserOut (Correcto)
@router.post("/users/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/setup/create-admin")
def create_initial_admin(db: Session = Depends(get_db)):
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if admin:
        return {"msg": "El usuario admin ya existe"}
    
    hashed_pw = security.get_password_hash("admin123")
    new_admin = models.User(username="admin", hashed_password=hashed_pw, role="admin")
    db.add(new_admin)
    db.commit()
    return {"msg": "Usuario 'admin' creado con contraseña 'admin123'"}
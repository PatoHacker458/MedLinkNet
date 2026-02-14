from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import datetime, timedelta
import models, schemas, security
from database import engine, get_db

# Inicializar BD
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MedLinkNet API", version="2.0.0 (Secure)")

# CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. AUTENTICACIÓN Y SETUP
# ==========================================

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Endpoint de Setup (Solo para primer uso, crea un admin si no hay usuarios)
@app.post("/setup/create-admin")
def create_initial_admin(db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="El sistema ya tiene usuarios. Usa el endpoint de registro normal.")
    
    hashed_pw = security.get_password_hash("admin123")
    admin_user = models.User(username="admin", hashed_password=hashed_pw, role="admin")
    db.add(admin_user)
    db.commit()
    return {"msg": "Usuario 'admin' creado con contraseña 'admin123'"}

# Registrar nuevo usuario (Requiere ser Admin logueado - Implementación futura de roles)
# Por ahora lo dejamos abierto para facilitar pruebas, o podrías protegerlo así:
# def create_user(user: schemas.UserCreate, current_user: models.User = Depends(security.get_current_user), ...)
@app.post("/users/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_pw = security.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_pw, role=user.role)
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

# ==========================================
# 2. INVENTARIO (PROTEGIDO)
# ==========================================

@app.get("/products/", response_model=List[schemas.Product])
def read_products(db: Session = Depends(get_db)):
    # Lectura pública (o proteger si se desea)
    return db.query(models.Product).all()

@app.post("/products/", response_model=schemas.Product)
def create_product(
    product: schemas.ProductCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user) # <--- CANDADO
):
    db_product = db.query(models.Product).filter(models.Product.sku == product.sku).first()
    if db_product:
        raise HTTPException(status_code=400, detail="SKU existente")
    
    new_product = models.Product(**product.dict())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

# ==========================================
# 3. ENTRADAS Y SALIDAS (KARDEX AUDITABLE)
# ==========================================

@app.post("/products/{product_id}/batches/", response_model=schemas.Batch)
def create_batch(
    product_id: int, 
    batch: schemas.BatchCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user) # <--- CANDADO
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product: raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    new_batch = models.Batch(**batch.dict(), product_id=product_id)
    db.add(new_batch)
    db.flush()
    
    # AUDITORÍA CON USUARIO
    transaction = models.Transaction(
        product_id=product_id,
        batch_id=new_batch.id,
        user_id=current_user.id, # <--- Registro de QUIÉN
        transaction_type="IN",
        quantity=batch.quantity,
        timestamp=datetime.now()
    )
    db.add(transaction)
    db.commit()
    db.refresh(new_batch)
    return new_batch

@app.post("/products/{product_id}/dispense/")
def dispense_product(
    product_id: int, 
    request: schemas.DispenseRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user) # <--- CANDADO
):
    qty_needed = request.quantity
    batches = db.query(models.Batch).filter(models.Batch.product_id == product_id, models.Batch.quantity > 0).order_by(models.Batch.expiration_date.asc()).all()
    
    total_stock = sum(b.quantity for b in batches)
    if total_stock < qty_needed:
        raise HTTPException(status_code=400, detail="Stock insuficiente")

    qty_remaining = qty_needed
    for batch in batches:
        if qty_remaining <= 0: break
        
        qty_taken = min(batch.quantity, qty_remaining)
        batch.quantity -= qty_taken
        qty_remaining -= qty_taken
        
        # AUDITORÍA CON USUARIO
        transaction = models.Transaction(
            product_id=product_id,
            batch_id=batch.id,
            user_id=current_user.id, # <--- Registro de QUIÉN
            transaction_type="OUT",
            quantity=qty_taken,
            timestamp=datetime.now()
        )
        db.add(transaction)

    db.commit()
    return {"message": "Dispensado exitosamente", "operator": current_user.username}

@app.get("/transactions/{product_id}", response_model=List[schemas.TransactionOut])
def read_history(product_id: int, db: Session = Depends(get_db)):
    # Hacemos un JOIN para traer el nombre del usuario
    results = db.query(models.Transaction, models.User.username)\
        .join(models.User, models.Transaction.user_id == models.User.id)\
        .filter(models.Transaction.product_id == product_id)\
        .order_by(models.Transaction.timestamp.desc()).all()
    
    # Formateamos la respuesta para que coincida con el Schema
    output = []
    for txn, username in results:
        txn_dict = txn.__dict__
        txn_dict["username"] = username
        output.append(txn_dict)
    
    return output


@app.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # 1. KPIs Generales
    total_products = db.query(models.Product).count()
    
    # 2. Calcular bajo stock (esto es mejor hacerlo con SQL directo en prod, pero en Python sirve por ahora)
    products = db.query(models.Product).all()
    low_stock_count = 0
    for p in products:
        total_qty = sum(b.quantity for b in p.batches)
        if total_qty < p.min_stock:
            low_stock_count += 1
            
    # 3. Lotes por vencer (próximos 30 días)
    thirty_days_ahead = datetime.now().date() + timedelta(days=30)
    expiring_soon = db.query(models.Batch).filter(
        models.Batch.expiration_date <= thirty_days_ahead,
        models.Batch.quantity > 0
    ).count()

    # 4. Últimos 5 movimientos globales (con nombre de usuario)
    recent_txs = db.query(models.Transaction, models.User.username)\
        .join(models.User, models.Transaction.user_id == models.User.id)\
        .order_by(models.Transaction.timestamp.desc())\
        .limit(5).all()
        
    formatted_txs = []
    for txn, user in recent_txs:
        t = txn.__dict__
        t["username"] = user
        formatted_txs.append(t)

    return {
        "total_products": total_products,
        "low_stock": low_stock_count,
        "expiring_batches": expiring_soon,
        "recent_transactions": formatted_txs
    }

# --- GESTIÓN DE ERRORES Y CORRECCIONES ---

@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    # Buscamos el producto
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # SQLAlchemy borrará en cascada los lotes y transacciones si está configurado,
    # pero por seguridad lo hacemos manual o confiamos en la FK.
    db.delete(product)
    db.commit()
    return {"msg": "Producto eliminado correctamente"}

@app.delete("/batches/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    # Advertencia: Borrar un lote elimina su historial de entradas.
    # Si ya se usó para dispensar, esas transacciones quedarán huérfanas o se borrarán.
    db.delete(batch)
    db.commit()
    return {"msg": "Lote eliminado"}

@app.post("/transactions/{transaction_id}/revert")
def revert_transaction(transaction_id: int, db: Session = Depends(get_db)):
    # 1. Buscar la transacción
    txn = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    # 2. Solo permitimos revertir SALIDAS (Dispensaciones) por ahora
    if txn.transaction_type != "OUT":
        raise HTTPException(status_code=400, detail="Solo se pueden revertir salidas. Para entradas, elimine el lote.")

    # 3. Devolver el stock al lote original
    batch = db.query(models.Batch).filter(models.Batch.id == txn.batch_id).first()
    if batch:
        batch.quantity += txn.quantity # Regresamos la medicina
    else:
        raise HTTPException(status_code=400, detail="El lote original ya no existe, no se puede revertir.")

    # 4. Eliminar el registro de la transacción (Es como si nunca hubiera pasado)
    db.delete(txn)
    db.commit()
    
    return {"msg": "Transacción revertida y stock restaurado"}
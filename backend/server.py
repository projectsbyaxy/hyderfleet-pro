from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import json
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('SECRET_KEY', 'hyderfleet-secret-key-change-in-production')
ALGORITHM = "HS256"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    role: str  # admin, driver, viewer
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plate_number: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    status: str  # idle, en-route, maintenance
    location: Dict[str, float]  # {lat, lng}
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    vehicle_type: str
    load_capacity: float
    current_load: float = 0.0

class DeliveryJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_number: str
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: str  # pending, in-transit, delivered
    zone: str  # Patancheru, Medchal, Shamshabad
    pickup_location: Dict[str, Any]
    delivery_location: Dict[str, Any]
    load_type: str
    load_weight: float
    estimated_eta: str
    actual_eta: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # delay, maintenance, overload
    severity: str  # low, medium, high
    message: str
    vehicle_id: Optional[str] = None
    job_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    acknowledged: bool = False

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    coordinates: Dict[str, float]  # center coordinates
    delay_count: int = 0

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"username": username}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role
    )
    
    user_dict = user.model_dump()
    user_dict["password"] = get_password_hash(user_data.password)
    
    await db.users.insert_one(user_dict)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user or not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": user["username"]})
    user_obj = User(**{k: v for k, v in user.items() if k != "password"})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Vehicle endpoints
@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(current_user: User = Depends(get_current_user)):
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(1000)
    return vehicles

@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, current_user: User = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, vehicle_data: Vehicle, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    vehicle_dict = vehicle_data.model_dump()
    vehicle_dict["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": vehicle_dict})
    
    # Broadcast update via WebSocket
    await manager.broadcast({"type": "vehicle_update", "data": vehicle_dict})
    
    return vehicle_data

# Delivery jobs endpoints
@api_router.get("/jobs", response_model=List[DeliveryJob])
async def get_jobs(
    status: Optional[str] = None,
    zone: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    if zone:
        query["zone"] = zone
    
    jobs = await db.delivery_jobs.find(query, {"_id": 0}).to_list(1000)
    return jobs

@api_router.get("/jobs/{job_id}", response_model=DeliveryJob)
async def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await db.delivery_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@api_router.put("/jobs/{job_id}", response_model=DeliveryJob)
async def update_job(job_id: str, job_data: DeliveryJob, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    job_dict = job_data.model_dump()
    await db.delivery_jobs.update_one({"id": job_id}, {"$set": job_dict})
    
    # Broadcast update via WebSocket
    await manager.broadcast({"type": "job_update", "data": job_dict})
    
    return job_data

# Alerts endpoints
@api_router.get("/alerts", response_model=List[Alert])
async def get_alerts(
    acknowledged: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    
    alerts = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return alerts

@api_router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.alerts.update_one({"id": alert_id}, {"$set": {"acknowledged": True}})
    
    # Broadcast update via WebSocket
    await manager.broadcast({"type": "alert_acknowledged", "alert_id": alert_id})
    
    return {"message": "Alert acknowledged"}

# Analytics endpoints
@api_router.get("/analytics/daily-deliveries")
async def get_daily_deliveries(current_user: User = Depends(get_current_user)):
    # Get last 7 days of delivery data
    today = datetime.now(timezone.utc)
    seven_days_ago = today - timedelta(days=7)
    
    jobs = await db.delivery_jobs.find(
        {"status": "delivered", "completed_at": {"$gte": seven_days_ago.isoformat()}},
        {"_id": 0, "completed_at": 1}
    ).to_list(1000)
    
    # Group by day
    daily_counts = {}
    for job in jobs:
        if job.get("completed_at"):
            date = job["completed_at"][:10]
            daily_counts[date] = daily_counts.get(date, 0) + 1
    
    return {"daily_deliveries": daily_counts}

@api_router.get("/analytics/on-time-percentage")
async def get_on_time_percentage(current_user: User = Depends(get_current_user)):
    delivered_jobs = await db.delivery_jobs.find({"status": "delivered"}, {"_id": 0}).to_list(1000)
    
    if not delivered_jobs:
        return {"on_time_percentage": 0, "total_jobs": 0}
    
    on_time = 0
    for job in delivered_jobs:
        if job.get("estimated_eta") and job.get("actual_eta"):
            estimated = datetime.fromisoformat(job["estimated_eta"])
            actual = datetime.fromisoformat(job["actual_eta"])
            if actual <= estimated + timedelta(minutes=15):
                on_time += 1
    
    percentage = (on_time / len(delivered_jobs)) * 100
    return {"on_time_percentage": round(percentage, 2), "total_jobs": len(delivered_jobs), "on_time_jobs": on_time}

@api_router.get("/analytics/zone-delays")
async def get_zone_delays(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(100)
    return {"zones": zones}

# Zones endpoints
@api_router.get("/zones", response_model=List[Zone])
async def get_zones(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(100)
    return zones

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Initialize mock data
@api_router.post("/init-mock-data")
async def init_mock_data():
    # Check if data already exists
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        return {"message": "Mock data already initialized"}
    
    # Create users
    users = [
        {"username": "admin", "email": "admin@hyderfleet.com", "password": get_password_hash("admin123"), "role": "admin", "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()},
        {"username": "driver1", "email": "driver1@hyderfleet.com", "password": get_password_hash("driver123"), "role": "driver", "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()},
        {"username": "viewer", "email": "viewer@hyderfleet.com", "password": get_password_hash("viewer123"), "role": "viewer", "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.users.insert_many(users)
    
    # Create zones
    zones = [
        {"id": str(uuid.uuid4()), "name": "Patancheru", "coordinates": {"lat": 17.5333, "lng": 78.2644}, "delay_count": 12},
        {"id": str(uuid.uuid4()), "name": "Medchal", "coordinates": {"lat": 17.6260, "lng": 78.4813}, "delay_count": 8},
        {"id": str(uuid.uuid4()), "name": "Shamshabad", "coordinates": {"lat": 17.2543, "lng": 78.3972}, "delay_count": 15},
    ]
    await db.zones.insert_many(zones)
    
    # Create vehicles
    vehicles = []
    vehicle_statuses = ["idle", "en-route", "maintenance"]
    vehicle_types = ["Truck", "Van", "Mini Truck"]
    driver_names = ["Rajesh Kumar", "Amit Singh", "Vijay Reddy", "Suresh Rao", "Prakash Naidu", "Krishna Murthy", "Ramesh Babu", "Srinivas Goud", "Venkat Rao", "Mahesh Kumar"]
    
    # Hyderabad area coordinates range
    lat_range = (17.2, 17.7)
    lng_range = (78.2, 78.6)
    
    import random
    
    for i in range(20):
        vehicle = {
            "id": str(uuid.uuid4()),
            "plate_number": f"TS{random.randint(10, 39):02d}{chr(random.randint(65, 90))}{chr(random.randint(65, 90))}{random.randint(1000, 9999)}",
            "driver_id": str(uuid.uuid4()),
            "driver_name": random.choice(driver_names),
            "status": vehicle_statuses[i % 3],
            "location": {
                "lat": random.uniform(lat_range[0], lat_range[1]),
                "lng": random.uniform(lng_range[0], lng_range[1])
            },
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "vehicle_type": random.choice(vehicle_types),
            "load_capacity": random.choice([5000, 8000, 10000]),
            "current_load": random.uniform(0, 5000)
        }
        vehicles.append(vehicle)
    
    await db.vehicles.insert_many(vehicles)
    
    # Create delivery jobs
    jobs = []
    job_statuses = ["pending", "in-transit", "delivered"]
    load_types = ["Electronics", "Pharmaceuticals", "Food Items", "Building Materials", "Textiles", "Machinery Parts"]
    zone_names = ["Patancheru", "Medchal", "Shamshabad"]
    
    for i in range(50):
        zone = random.choice(zone_names)
        status = random.choice(job_statuses)
        created_time = datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 72))
        eta_time = created_time + timedelta(hours=random.randint(1, 8))
        
        job = {
            "id": str(uuid.uuid4()),
            "job_number": f"HF{(i+1):04d}",
            "vehicle_id": random.choice(vehicles)["id"] if status != "pending" else None,
            "driver_id": str(uuid.uuid4()) if status != "pending" else None,
            "status": status,
            "zone": zone,
            "pickup_location": {
                "address": f"{zone} Industrial Area, Sector {random.randint(1, 10)}",
                "lat": random.uniform(lat_range[0], lat_range[1]),
                "lng": random.uniform(lng_range[0], lng_range[1])
            },
            "delivery_location": {
                "address": f"Hyderabad City, {random.choice(['Gachibowli', 'Hitech City', 'Jubilee Hills', 'Banjara Hills', 'Secunderabad'])}",
                "lat": random.uniform(lat_range[0], lat_range[1]),
                "lng": random.uniform(lng_range[0], lng_range[1])
            },
            "load_type": random.choice(load_types),
            "load_weight": round(random.uniform(100, 5000), 2),
            "estimated_eta": eta_time.isoformat(),
            "actual_eta": (eta_time + timedelta(minutes=random.randint(-30, 60))).isoformat() if status == "delivered" else None,
            "created_at": created_time.isoformat(),
            "completed_at": (created_time + timedelta(hours=random.randint(2, 10))).isoformat() if status == "delivered" else None
        }
        jobs.append(job)
    
    await db.delivery_jobs.insert_many(jobs)
    
    # Create alerts
    alerts = []
    alert_types = ["delay", "maintenance", "overload"]
    alert_severities = ["low", "medium", "high"]
    
    for i in range(15):
        alert_type = random.choice(alert_types)
        severity = random.choice(alert_severities)
        
        if alert_type == "delay":
            message = f"Job {random.choice(jobs)['job_number']} delayed by {random.randint(15, 90)} minutes"
        elif alert_type == "maintenance":
            message = f"Vehicle {random.choice(vehicles)['plate_number']} maintenance due in {random.randint(1, 7)} days"
        else:
            message = f"Vehicle {random.choice(vehicles)['plate_number']} load exceeds safe threshold"
        
        alert = {
            "id": str(uuid.uuid4()),
            "type": alert_type,
            "severity": severity,
            "message": message,
            "vehicle_id": random.choice(vehicles)["id"],
            "job_id": random.choice(jobs)["id"] if alert_type == "delay" else None,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 48))).isoformat(),
            "acknowledged": random.choice([True, False])
        }
        alerts.append(alert)
    
    await db.alerts.insert_many(alerts)
    
    return {"message": "Mock data initialized successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
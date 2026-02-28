from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    ratings_count: int
    
    class Config:
        from_attributes = True

class MovieCard(BaseModel):
    tconst: str
    primaryTitle: str
    startYear: int
    averageRating: float
    numVotes: int
    score: Optional[float] = None
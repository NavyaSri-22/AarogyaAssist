
from sqlalchemy import text
from database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT DATABASE()")
        )
        print("Connected database:", result.scalar())
        print("MySQL connection successful!")

except Exception as error:
    print("MySQL connection failed:")
    print(error)

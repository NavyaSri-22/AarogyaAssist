
from sqlalchemy import text
from database import engine

try:
    with engine.connect() as connection:

        database_type = engine.dialect.name

        if database_type == "postgresql":
            result = connection.execute(
                text("SELECT current_database()")
            )
            database_name = result.scalar()

            print("Connected database:", database_name)
            print("PostgreSQL connection successful!")

        elif database_type == "mysql":
            result = connection.execute(
                text("SELECT DATABASE()")
            )
            database_name = result.scalar()

            print("Connected database:", database_name)
            print("MySQL connection successful!")

        else:
            print("Connected database type:", database_type)

except Exception as error:
    print("Database connection failed:")
    print(error)

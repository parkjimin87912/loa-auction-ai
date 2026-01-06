# analysis.py (MariaDB 연동 버전)
import sys
import json
import pandas as pd
import pymysql
import os
import io  # <--- [추가]

# [핵심] 파이썬의 출력을 강제로 UTF-8로 고정한다 (이러면 Node.js에서 안 깨짐)
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8')

from datetime import datetime
from dotenv import load_dotenv

# ... (나머지 코드는 건드리지 마라)
# .env 파일에서 DB 정보 가져오기
load_dotenv()

# DB 접속 설정
DB_CONFIG = {
    'host': os.getenv('MARIADB_HOST', 'localhost'),
    'user': os.getenv('MARIADB_USER', 'root'),
    'password': os.getenv('MARIADB_PASSWORD', ''),
    'database': os.getenv('MARIADB_DB', 'loa_bot'),
    'port': int(os.getenv('MARIADB_PORT', 3306)),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def save_to_mariadb(df):
    connection = None
    try:
        # 1. MariaDB 연결
        connection = pymysql.connect(**DB_CONFIG)

        with connection.cursor() as cursor:
            # 2. 테이블이 없으면 생성 (자동)
            sql_create_table = """
                               CREATE TABLE IF NOT EXISTS market_prices (
                                                                            id INT AUTO_INCREMENT PRIMARY KEY,
                                                                            collected_at DATETIME,
                                                                            name VARCHAR(100),
                                   price INT,
                                   grade VARCHAR(50),
                                   z_score FLOAT
                                   ) \
                               """
            cursor.execute(sql_create_table)

            # 3. 데이터 대량 삽입 (Bulk Insert)
            sql_insert = """
                         INSERT INTO market_prices (collected_at, name, price, grade, z_score)
                         VALUES (%s, %s, %s, %s, %s) \
                         """

            # DataFrame을 튜플 리스트로 변환
            data_list = []
            for _, row in df.iterrows():
                data_list.append((
                    row['collected_at'],
                    row['name'],
                    row['price'],
                    row['grade'],
                    row['z_score']
                ))

            cursor.executemany(sql_insert, data_list)
            connection.commit()

        return f"MariaDB에 {len(data_list)}개 데이터 저장 성공"

    except Exception as e:
        return f"DB 저장 실패: {str(e)}"

    finally:
        if connection:
            connection.close()

def analyze_market_data(item_data):
    try:
        # 데이터 프레임 변환
        df = pd.DataFrame(item_data)
        if len(df) < 1: return []

        # 통계 분석 (Z-Score)
        mean_price = df['price'].mean()
        std_dev = df['price'].std()

        if std_dev == 0:
            df['z_score'] = 0
        else:
            df['z_score'] = (df['price'] - mean_price) / std_dev

        # 수집 시간 추가
        df['collected_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # [핵심] MariaDB에 저장!
        db_message = save_to_mariadb(df)

        # 결과 반환 (상위 5개)
        recommendations = df.sort_values(by='z_score', ascending=True).head(5)
        result = recommendations[['name', 'price', 'grade', 'z_score']].to_dict(orient='records')

        # DB 메시지를 결과에 살짝 포함시켜서 확인
        if result:
            result[0]['db_status'] = db_message

        return result

    except Exception as e:
        return [{"name": "Error", "price": 0, "grade": str(e), "z_score": 0}]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            input_json = sys.argv[1]
            real_data = json.loads(input_json)
            analyzed_result = analyze_market_data(real_data)
            print(json.dumps(analyzed_result, ensure_ascii=False))
        except:
            print("[]")
    else:
        print("[]")
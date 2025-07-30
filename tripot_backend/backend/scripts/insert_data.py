# scripts/insert_data.py
# 퀴즈와 '오늘의 질문' 데이터를 CSV 파일에서 읽어 DB에 삽입하는 스크립트

import os
import csv
import sys
from pathlib import Path
from dotenv import load_dotenv
import mysql.connector

def setup_path():
    """스크립트가 'app' 모듈을 찾을 수 있도록 경로를 설정합니다."""
    project_root = Path(__file__).resolve().parents[1]
    sys.path.append(str(project_root))
    print(f"프로젝트 루트 경로가 추가되었습니다: {project_root}")

def get_mysql_connection():
    """
    .env 파일의 정보를 바탕으로 MySQL 데이터베이스에 연결합니다.
    이 스크립트는 'docker-compose exec'를 통해 컨테이너 내부에서 실행되는 것을 가정합니다.
    """
    env_path = Path(__file__).resolve().parents[1] / '.env'
    load_dotenv(dotenv_path=env_path)
    
    try:
        # Docker 내부에서는 .env에 설정된 호스트('db')와 포트('3306')를 직접 사용해야 합니다.
        host = os.getenv('MYSQL_HOST')
        port = int(os.getenv('MYSQL_PORT'))
        
        connection = mysql.connector.connect(
            host=host,
            port=port,
            user=os.getenv('MYSQL_USER'),
            password=os.getenv('MYSQL_PASSWORD'),
            database=os.getenv('MYSQL_DATABASE')
        )
        print(f"✅ MySQL 데이터베이스에 성공적으로 연결되었습니다. (Host: {host}:{port})")
        return connection
    except mysql.connector.Error as err:
        print(f"❌ 데이터베이스 연결 오류: {err}")
        return None

def insert_quiz_data(connection, csv_file_path):
    """CSV 파일의 퀴즈 데이터를 quiz 테이블에 삽입합니다."""
    cursor = connection.cursor()
    try:
        print("--- 퀴즈 데이터 처리 시작 ---")
        print("🗑️ 기존 quiz 테이블의 모든 데이터를 삭제합니다...")
        cursor.execute("TRUNCATE TABLE quiz")
        
        with open(csv_file_path, mode='r', encoding='utf-8') as file:
            reader = csv.reader(file)
            next(reader)  # 헤더 행 건너뛰기
            
            insert_query = "INSERT INTO quiz (topic, question_text, answer) VALUES (%s, %s, %s)"
            count = 0
            for row in reader:
                cursor.execute(insert_query, (row[1], row[2], row[3]))
                count += 1
            
            connection.commit()
            print(f"🎉 총 {count}개의 퀴즈 데이터가 성공적으로 삽입되었습니다.")
    except FileNotFoundError:
        print(f"❌ 오류: 퀴즈 CSV 파일을 찾을 수 없습니다. '{csv_file_path}'")
    except Exception as e:
        print(f"❌ 퀴즈 데이터 삽입 중 오류 발생: {e}")
        connection.rollback()
    finally:
        cursor.close()

def insert_daily_question_data(connection, csv_file_path):
    """CSV 파일의 '오늘의 질문' 데이터를 daily_qa 테이블에 삽입/업데이트합니다."""
    cursor = connection.cursor()
    try:
        print("--- '오늘의 질문' 데이터 처리 시작 ---")
        with open(csv_file_path, mode='r', encoding='utf-8') as file:
            reader = csv.reader(file)
            next(reader)  # 헤더 행 건너뛰기

            # 이미 날짜가 존재하면 질문 내용을 업데이트 (UPSERT)
            upsert_query = """
            INSERT INTO daily_qa (daily_date, question_text) VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE question_text = VALUES(question_text)
            """
            count = 0
            for row in reader:
                cursor.execute(upsert_query, (row[1], row[2]))
                count += 1
            
            connection.commit()
            print(f"🎉 총 {count}개의 '오늘의 질문' 데이터가 성공적으로 처리되었습니다.")
    except FileNotFoundError:
        print(f"❌ 오류: '오늘의 질문' CSV 파일을 찾을 수 없습니다. '{csv_file_path}'")
    except Exception as e:
        print(f"❌ '오늘의 질문' 데이터 처리 중 오류 발생: {e}")
        connection.rollback()
    finally:
        cursor.close()

def main():
    """스크립트의 메인 실행 함수입니다."""
    # 1. 파일 경로 설정
    quiz_csv_path = Path(__file__).resolve().parent / 'quiz1.csv'
    daily_question_csv_path = Path(__file__).resolve().parent / 'daily_question.csv'
    
    # 2. DB 연결
    conn = get_mysql_connection()
    
    # 3. 각 데이터 삽입 함수 실행
    if conn:
        insert_quiz_data(conn, quiz_csv_path)
        print("-" * 20)
        insert_daily_question_data(conn, daily_question_csv_path)
        
        conn.close()
        print("\n🚪 데이터베이스 연결을 닫았습니다.")

if __name__ == "__main__":
    setup_path()
    main()

# analysis.py
import sys
import json
import pandas as pd
import numpy as np

# 면접용 한 줄 요약: "최근 거래 데이터의 표준편차를 활용해 이상치(꿀매물)를 탐지합니다."

def analyze_market_data(item_data):
    """
    Node.js에서 넘겨받은 경매장 데이터를 분석하는 함수
    :param item_data: List of dictionaries (가격, 거래시간 등 포함)
    """
    try:
        # 1. 데이터 프레임 변환
        df = pd.DataFrame(item_data)

        # 데이터가 너무 적으면 분석 불가 (예외처리)
        if len(df) < 5:
            return []

        # 2. 통계적 분석 (Z-Score 기법)
        # 평균(Mean)과 표준편차(Std) 계산
        mean_price = df['price'].mean()
        std_dev = df['price'].std()

        # 3. 꿀매물 판독 로직
        # Z-Score = (현재가격 - 평균) / 표준편차
        # 점수가 -1.5 이하면 평균보다 시그마 1.5배만큼 싸다는 뜻 (하위 6.7% 급매물)
        df['z_score'] = (df['price'] - mean_price) / std_dev

        # 임계값 설정 (이 수치를 조절해서 추천 민감도를 바꿈)
        THRESHOLD = -1.5

        # 4. 추천 리스트 필터링
        recommendations = df[df['z_score'] <= THRESHOLD].copy()

        # 결과 정리 (필요한 컬럼만 선택)
        result = recommendations[['name', 'price', 'grade', 'z_score']].to_dict(orient='records')

        return result

    except Exception as e:
        # 에러 발생 시 로그 남기기 (실무 습관)
        return {"error": str(e)}
# analysis.py 맨 아래 부분 교체

if __name__ == "__main__":
    # Node.js에서 인자(Argument)로 데이터를 던져주면 그걸 받는다
    if len(sys.argv) > 1:
        try:
            # sys.argv[1]에 들어온 JSON 문자열을 파이썬 리스트로 변환
            input_json = sys.argv[1]
            real_data = json.loads(input_json)

            # 분석 시작
            analyzed_result = analyze_market_data(real_data)

            # 결과를 다시 Node.js에게 출력(print)으로 돌려줌
            print(json.dumps(analyzed_result, ensure_ascii=False))
        except Exception as e:
            # 에러 나면 빈 리스트 반환 (서버 안 죽게)
            print("[]")
    else:
        # 테스트용 (데이터 없이 실행했을 때)
        print("[]")
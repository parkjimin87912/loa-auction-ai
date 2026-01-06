// scheduler.js
require('dotenv').config(); // .env 파일 로드
const axios = require('axios');
const { spawn } = require('child_process');

// API 설정
const API_URL = 'https://developer-lostark.game.onstove.com/auctions/items';
const API_KEY = process.env.LOSTARK_API_KEY;

console.log("🔄 [System] 로스트아크 경매장 봇 가동 시작...");

async function fetchAndAnalyze() {
    try {
        console.log("📡 [Network] 로스트아크 서버에 데이터 요청 중...");

        // 1. 로스트아크 API 호출 (전설 등급 각인서 검색)
        const response = await axios.post(
            API_URL,
            {
                Sort: "BUY_PRICE",
                CategoryCode: 40000, // 각인서
                ItemTier: 3,
                ItemGrade: "전설",   // [추가] 등급: 전설 (Legendary)
                ItemName: "원한",    // [추가] 이름: 원한 (Grudge) - 무조건 있는 매물
                PageNo: 0,
                SortCondition: "ASC" // 가격 싼 순서
            },
            {
                headers: {
                    'authorization': `bearer ${API_KEY}`,
                    'content-type': 'application/json'
                }
            }
        );

        const items = response.data.Items;
        if (!items || items.length === 0) {
            console.log("⚠️ [Info] 매물이 없거나 API 호출 실패");
            return;
        }

        console.log(`📥 [Data] ${items.length}개의 매물 수신 완료. 데이터 가공 중...`);

        // 2. 파이썬이 알아먹을 수 있게 데이터 정리 (이름, 가격, 등급만 추출)
        const cleanedData = items.map(item => ({
            name: item.Name,
            price: item.AuctionInfo.BuyPrice || item.AuctionInfo.StartPrice, // 즉구가 없으면 시작가
            grade: item.Grade
        }));

        // 3. 파이썬 분석 엔진 호출 (데이터를 문자열로 변환해서 전달)
        // 주의: 데이터가 너무 많으면 파일로 저장해서 넘겨야 하지만, 지금은 인자로 넘김
        const pythonProcess = spawn('python', ['analysis.py', JSON.stringify(cleanedData)]);

        let resultBuffer = "";

        pythonProcess.stdout.on('data', (data) => {
            resultBuffer += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.log(`❌ [Error] 분석 프로세스 종료 코드: ${code}`);
                return;
            }

            try {
                // 파이썬의 출력 결과(JSON) 파싱
                const recommendations = JSON.parse(resultBuffer);

                console.log("\n========================================");
                console.log(`🎉 [Result] AI 분석 완료! 꿀매물 발견: ${recommendations.length}건`);
                console.log("========================================");

                if (recommendations.length > 0) {
                    recommendations.forEach(item => {
                        console.log(`💎 [추천] ${item.name} | 가격: ${item.price}골드 (Z-Score: ${item.z_score.toFixed(2)})`);
                    });
                } else {
                    console.log("💨 현재 꿀매물이 없습니다. (모두 적정가)");
                }

            } catch (e) {
                console.error("❌ [Parsing Error] 파이썬 결과 해석 실패:", e.message);
            }
        });

    } catch (error) {
        console.error("❌ [Axios Error] API 호출 중 문제 발생:", error.message);
        if (error.response && error.response.status === 401) {
            console.error("👉 API 키가 틀렸거나 만료되었습니다. .env 파일을 확인하세요.");
        }
    }
}

// 봇 실행
fetchAndAnalyze();
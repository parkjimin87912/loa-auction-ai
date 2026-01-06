// scheduler.js (서버 + 자동수집 통합 버전)
require('dotenv').config();
const axios = require('axios');
const { spawn } = require('child_process');
const express = require('express'); // 웹 서버 기능 추가
const cors = require('cors');       // 포트폴리오 사이트 접속 허용

const app = express();
const PORT = 3000; // 서버 포트 번호

app.use(cors()); // 모든 사이트에서 접속 허용 (포트폴리오용)

const API_URL = 'https://developer-lostark.game.onstove.com/markets/items';
const API_KEY = process.env.LOSTARK_API_KEY;

// ==========================================
// 1. 데이터 수집 로직 (봇)
// ==========================================
async function fetchAndSave() {
    try {
        console.log(`\n⏰ [${new Date().toLocaleTimeString()}] 자동 수집 시작 (타겟: 유물 각인서)...`);

        const response = await axios.post(
            API_URL,
            {
                Sort: "CURRENT_MIN_PRICE",
                CategoryCode: 40000,
                ItemGrade: "유물",
                PageNo: 1,
                SortCondition: "DESC"
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
            console.log("❌ [Info] 매물이 없습니다.");
            return;
        }

        const cleanedData = items.map(item => ({
            name: item.Name,
            price: item.CurrentMinPrice,
            grade: item.Grade
        }));

        // 파이썬 호출해서 DB에 저장
        const pythonProcess = spawn('python', ['analysis.py', JSON.stringify(cleanedData)]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`📦 [DB 저장] ${data.toString().trim()}`);
        });

    } catch (error) {
        console.error("❌ [Error]:", error.message);
    }
}

// ==========================================
// 2. 포트폴리오용 API (프론트엔드가 요청하는 곳)
// ==========================================
// 누군가 http://localhost:3000/api/history 로 접속하면 DB 데이터를 줌
app.get('/api/history', (req, res) => {
    // 파이썬을 시켜서 DB 읽어오게 하기 (analysis.py에 읽기 기능 추가 필요)
    // 지금은 일단 "서버 살아있음" 메시지만 보냄
    res.json({
        message: "여기는 로스트아크 시세 서버입니다.",
        status: "Running",
        db_type: "MariaDB"
    });
});

// ==========================================
// 3. 서버 실행 및 스케줄러 가동
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 [Server] 포트폴리오용 서버가 http://localhost:${PORT} 에서 돌아가는 중...`);

    // 1. 켜지자마자 한 번 수집
    fetchAndSave();

    // 2. 이후 1시간(60분 * 60초 * 1000)마다 반복 수집
    setInterval(fetchAndSave, 60 * 60 * 1000);
    console.log("🔄 [System] 1시간 주기 자동 수집 스케줄러 가동됨.");
});
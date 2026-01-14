# 📊 실시간 의견 수집 및 AI 분석 도구

우리 반 학생들의 의견을 실시간으로 수집하고, 차트와 워드 클라우드로 시각화하며 Gemini AI를 통해 분석하는 도구입니다.

## 주요 기능
- **실시간 데이터 수집**: Firebase Firestore를 통한 실시간 의견 반영
- **데이터 시각화**: Recharts 기반의 도넛 차트 및 바 차트
- **스마트 워드 클라우드**: 빈도수에 따른 단어 구름 생성 (다양한 모양 지원)
- **AI 통찰 (Gemini)**: 의견들의 전체적인 감정 분석 및 핵심 테마 자동 추출

## 설치 및 배포 방법
1. 이 저장소를 복제하거나 다운로드합니다.
2. Firebase 프로젝트를 생성하고 `App.tsx`의 `firebaseConfig`를 본인의 설정으로 교체합니다.
3. Vercel이나 Netlify를 통해 배포할 때 환경 변수(Environment Variable)에 `API_KEY` (Gemini API Key)를 설정합니다.

## 기술 스택
- React 19
- Tailwind CSS
- Firebase Firestore
- Recharts (Visualization)
- Wordcloud2.js
- Google Gemini API (Analysis)

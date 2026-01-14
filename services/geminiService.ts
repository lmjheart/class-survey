
import { GoogleGenAI } from "@google/genai";
import { DataPoint } from "../types";

/**
 * AI 분석 기능을 Gemini API를 사용하여 구현합니다.
 * @param data 학생들의 의견 데이터 배열
 * @returns AI 분석 결과 문자열
 */
export const analyzeData = async (data: DataPoint[]) => {
  if (!data || data.length === 0) return "분석할 데이터가 없습니다.";

  // process.env.API_KEY를 사용하여 GoogleGenAI 인스턴스를 초기화합니다.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 분석할 텍스트 데이터를 구성합니다.
  const feedbackList = data.map(d => `- ${d.text}`).join('\n');
  const prompt = `다음은 학생들이 제출한 설문 의견들입니다. 이 내용들을 바탕으로 우리 반의 전반적인 분위기를 분석하고, 주요 키워드 3가지와 따뜻한 격려의 메시지를 요약해서 작성해 주세요.\n\n[의견 목록]\n${feedbackList}`;

  try {
    // 텍스트 기반 분석을 위해 'gemini-3-flash-preview' 모델을 사용합니다.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "당신은 학생들의 마음을 잘 이해하는 다정하고 전문적인 초등학교 선생님입니다. 학생들의 의견을 긍정적인 방향으로 분석하여 한국어로 답변해 주세요.",
      }
    });

    // response.text 속성을 통해 결과 텍스트를 추출합니다.
    return response.text || "분석 결과를 가져오지 못했습니다.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI 분석 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.";
  }
};

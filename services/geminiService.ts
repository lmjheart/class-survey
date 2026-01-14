
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeData = async (texts: string[]): Promise<AnalysisResult> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  if (texts.length === 0) {
    throw new Error("분석할 데이터가 없습니다.");
  }

  const prompt = `다음의 설문 응답 및 의견들을 분석하여 감정 상태, 종합 요약, 그리고 핵심 테마를 추출해 주세요. 
  **반드시 모든 응답(요약, 테마 등)은 한국어로 작성해야 합니다.**
  
  데이터 리스트:
  ${texts.join("\n")}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentiment: {
            type: Type.STRING,
            description: "전체적인 감정: positive(긍정), neutral(중립), 또는 negative(부정).",
          },
          summary: {
            type: Type.STRING,
            description: "의견들에 대한 2-3문장 정도의 한국어 요약.",
          },
          keyThemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "주요 테마 또는 반복되는 주제들의 한국어 리스트.",
          },
        },
        required: ["sentiment", "summary", "keyThemes"],
      },
    },
  });

  // Access the text property directly (not as a function)
  const resultText = response.text;
  if (!resultText) {
    throw new Error("분석 결과를 생성하는 데 실패했습니다.");
  }

  return JSON.parse(resultText.trim()) as AnalysisResult;
};

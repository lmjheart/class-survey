
import React, { useEffect, useRef } from 'react';
import WordCloud2 from 'wordcloud';

interface WordCloudProps {
  words: { name: string; value: number }[];
  shape: string;
}

const WordCloud: React.FC<WordCloudProps> = ({ words, shape }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || words.length === 0) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    // 부모 컨테이너 크기에 맞춰 캔버스 크기 설정
    const width = container.offsetWidth;
    const height = container.offsetHeight || 500;
    canvas.width = width;
    canvas.height = height;

    // 단어 데이터 정리
    const maxFreq = Math.max(...words.map(w => w.value));
    const uniqueCount = words.length;

    /**
     * 지능형 폰트 스케일링 로직
     * 1. 기본적으로 너비의 1/6 정도를 최대 크기로 잡음
     * 2. 단어 종류(uniqueCount)가 많아질수록 최대 크기를 줄여서 공간을 확보함
     */
    let targetMaxFontSize = width / 6;
    
    if (uniqueCount > 10) targetMaxFontSize = width / 8;
    if (uniqueCount > 30) targetMaxFontSize = width / 12;
    if (uniqueCount > 60) targetMaxFontSize = width / 16;

    // 절대적인 최대/최소 한계 설정 (가독성 보장)
    targetMaxFontSize = Math.max(Math.min(targetMaxFontSize, 120), 40);

    const factor = targetMaxFontSize / maxFreq;

    const list = words.map(w => [w.name, w.value]);

    const options = {
      list: list,
      // 그리드 사이즈가 작을수록 더 촘촘하게 배치됨 (단어가 많을 때 유리)
      gridSize: uniqueCount > 40 ? 4 : 8,
      weightFactor: factor,
      fontFamily: 'Inter, "Nanum Gothic", sans-serif',
      color: (word: string, weight: number) => {
        // 빈도수가 높을수록 더 진한 색상 부여
        const colors = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];
        const index = Math.min(Math.floor((maxFreq - (weight / factor)) / (maxFreq / colors.length)), colors.length - 1);
        return colors[index] || '#6366f1';
      },
      rotateRatio: 0.2, // 가로 글자 비중을 높여 가독성 향상
      rotationSteps: 2,
      backgroundColor: 'transparent',
      shape: shape,
      ellipticity: 0.8,
      minSize: uniqueCount > 50 ? 8 : 12, // 단어가 아주 많을 때는 작은 글씨도 허용
      drawOutOfBound: false, // 캔버스 밖으로 나가는 현상 방지
      shrinkToFit: true, // 공간이 부족하면 자동으로 줄임
      clearCanvas: true
    };

    try {
      WordCloud2(canvas, options as any);
    } catch (e) {
      console.error("WordCloud generation failed", e);
    }

  }, [words, shape]);

  return (
    <div ref={containerRef} className="w-full h-[550px] flex items-center justify-center relative overflow-hidden bg-slate-50/30 rounded-[2.5rem] border border-slate-100 shadow-inner">
      <canvas ref={canvasRef} className="max-w-full transition-opacity duration-500" />
      {words.length === 0 && (
        <div className="absolute text-center">
           <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
             <span className="text-xl">☁️</span>
           </div>
           <p className="text-slate-400 font-bold text-sm">데이터가 입력되면<br/>클라우드가 생성됩니다.</p>
        </div>
      )}
    </div>
  );
};

export default WordCloud;

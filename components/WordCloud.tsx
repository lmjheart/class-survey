
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
    
    const width = container.offsetWidth;
    const height = container.offsetHeight || 500;
    canvas.width = width;
    canvas.height = height;

    const maxFreq = Math.max(...words.map(w => w.value));
    const uniqueCount = words.length;

    let targetMaxFontSize = width / 6;
    if (uniqueCount > 10) targetMaxFontSize = width / 8;
    if (uniqueCount > 30) targetMaxFontSize = width / 12;

    targetMaxFontSize = Math.max(Math.min(targetMaxFontSize, 120), 40);
    const factor = targetMaxFontSize / maxFreq;

    // 더 다채로운 색상 팔레트
    const palette = [
      '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#fb923c', 
      '#fbbf24', '#22c55e', '#06b6d4', '#3b82f6', '#ec4899'
    ];

    const options = {
      list: words.map(w => [w.name, w.value]),
      gridSize: uniqueCount > 40 ? 4 : 8,
      weightFactor: factor,
      fontFamily: 'Inter, "Nanum Gothic", sans-serif',
      color: () => {
        // 무작위로 팔레트에서 색상 선택
        return palette[Math.floor(Math.random() * palette.length)];
      },
      rotateRatio: 0.3,
      rotationSteps: 2,
      backgroundColor: 'transparent',
      shape: shape,
      ellipticity: 0.8,
      minSize: 10,
      drawOutOfBound: false,
      shrinkToFit: true,
      clearCanvas: true
    };

    try {
      WordCloud2(canvas, options as any);
    } catch (e) {
      console.error("WordCloud generation failed", e);
    }

  }, [words, shape]);

  return (
    <div ref={containerRef} className="w-full h-[550px] flex items-center justify-center relative overflow-hidden bg-white rounded-[2.5rem] border border-slate-100 shadow-inner">
      <canvas ref={canvasRef} className="max-w-full" />
      {words.length === 0 && (
        <div className="absolute text-center">
           <p className="text-slate-400 font-bold text-sm">의견이 입력되면 클라우드가 생성됩니다.</p>
        </div>
      )}
    </div>
  );
};

export default WordCloud;

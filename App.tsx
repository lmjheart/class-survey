import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Table as TableIcon, PieChart as ChartIcon, Cloud, Trash2, AlertCircle, Settings, 
  ClipboardList, Eraser, LayoutDashboard, Unlock, Lock,
  Sparkles, BrainCircuit, MessageSquare, Quote, Radio, Users
} from 'lucide-react';
import { initializeApp, getApp, getApps } from "firebase/app";
// Fix: Consolidating Firestore imports to a single line to ensure correct module member resolution across different build environments
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, writeBatch, setDoc } from "firebase/firestore";
import { DataPoint, TabType, AnalysisResult } from './types';
import WordCloud from './components/WordCloud';
import { analyzeData } from './services/geminiService';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
const ADMIN_PASSWORD = "teacher123";

const shapes = [
  { id: 'circle', name: '원형' },
  { id: 'cardioid', name: '하트' },
  { id: 'diamond', name: '다이아몬드' },
  { id: 'square', name: '사각형' },
  { id: 'triangle', name: '삼각형' },
];

const firebaseConfig = {
  apiKey: "AIzaSyCzKNOTMXL77HR1CF_oMdbLIZl_ErknZa8",
  authDomain: "my-class-survey.firebaseapp.com",
  projectId: "my-class-survey",
  storageBucket: "my-class-survey.firebasestorage.app",
  messagingSenderId: "251557382930",
  appId: "1:251557382930:web:7cbf46beee0540528441cb"
};

const isFirebaseReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

let db: any = null;
if (isFirebaseReady) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
    db = null;
  }
}

const App: React.FC = () => {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [topic, setTopic] = useState('우리 반의 오늘 기분은 어떤가요?');
  const [inputValue, setInputValue] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(TabType.TABLE);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(false);
  
  const [mySubmissionCount, setMySubmissionCount] = useState(() => {
    const count = localStorage.getItem('my_submission_count');
    return count ? parseInt(count) : 0;
  });
  
  const [cloudShape, setCloudShape] = useState<string>('circle');
  const MAX_SUBMISSIONS = 10;

  useEffect(() => {
    if (db) {
      const q = query(collection(db, "responses"), orderBy("timestamp", "desc"));
      const unsubscribeResponses = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DataPoint[];
        setDataPoints(data);
        setIsDbConnected(true);
      }, (err) => {
        console.error("Firestore error:", err);
        setIsDbConnected(false);
      });

      const unsubscribeTopic = onSnapshot(doc(db, "config", "current_topic"), (doc) => {
        if (doc.exists()) setTopic(doc.data().text);
      });

      return () => {
        unsubscribeResponses();
        unsubscribeTopic();
      };
    } else {
      const savedData = localStorage.getItem('local_responses');
      if (savedData) setDataPoints(JSON.parse(savedData));
      const savedTopic = localStorage.getItem('local_topic');
      if (savedTopic) setTopic(savedTopic);
    }
  }, []);

  useEffect(() => {
    if (!db) {
      localStorage.setItem('local_responses', JSON.stringify(dataPoints));
      localStorage.setItem('local_topic', topic);
    }
    localStorage.setItem('my_submission_count', mySubmissionCount.toString());
  }, [dataPoints, topic, mySubmissionCount]);

  const handleAdminLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setError(null);
    } else {
      setError("암호가 틀렸습니다.");
      setTimeout(() => setError(null), 2000);
    }
  };

  const handleAddData = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    if (!isAdmin && mySubmissionCount >= MAX_SUBMISSIONS) {
      setError(`최대 ${MAX_SUBMISSIONS}번까지만 입력할 수 있습니다.`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (db) {
      try {
        await addDoc(collection(db, "responses"), { text: trimmed, timestamp: Date.now() });
      } catch (e) { 
        setError("서버 전송 실패. Firestore 보안 규칙을 확인하세요."); 
        return; 
      }
    } else {
      const newPoint: DataPoint = { id: Date.now().toString(), text: trimmed, timestamp: Date.now() };
      setDataPoints(prev => [newPoint, ...prev]);
    }
    
    setInputValue('');
    if (!isAdmin) setMySubmissionCount(prev => prev + 1);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (db) {
      try {
        await deleteDoc(doc(db, "responses", id));
      } catch (e) { setError("삭제 실패"); }
    } else {
      setDataPoints(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUpdateTopic = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTopic = formData.get('topic-input') as string;
    if (!newTopic.trim()) return;

    if (db) {
      await setDoc(doc(db, "config", "current_topic"), { text: newTopic.trim() });
    } else {
      setTopic(newTopic.trim());
    }
    setError("질문이 변경되었습니다.");
    setTimeout(() => setError(null), 2000);
  };

  const handleClearAll = async () => {
    if (!confirm("모든 데이터를 초기화할까요?")) return;
    if (db) {
      const querySnapshot = await getDocs(collection(db, "responses"));
      const batch = writeBatch(db);
      querySnapshot.forEach(d => batch.delete(doc(db, "responses", d.id)));
      await batch.commit();
    } else {
      setDataPoints([]);
    }
    setMySubmissionCount(0);
    setAnalysisResult(null);
  };

  const handleAIDiagnosis = async () => {
    if (dataPoints.length < 3) {
      setError("분석을 위해 최소 3개 이상의 데이터가 필요합니다.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const texts = dataPoints.map(p => p.text);
      const result = await analyzeData(texts);
      setAnalysisResult(result);
    } catch (e: any) {
      setError("AI 분석 실패: API 키를 설정했는지 확인하세요.");
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const frequencyData = useMemo(() => {
    const counts: Record<string, number> = {};
    dataPoints.forEach(p => { counts[p.text] = (counts[p.text] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dataPoints]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header & Status Indicator */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">실시간 의견 수집기</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'}`} />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isDbConnected ? '실시간 클라우드 연결됨' : '로컬 모드 작동 중'}
              </span>
            </div>
          </div>
        </div>

        <div className="inline-flex bg-slate-200/60 p-1 rounded-2xl border border-slate-200/80 backdrop-blur-sm">
          <button onClick={() => setIsAdmin(false)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${!isAdmin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Users className="w-4 h-4" /> 학생 모드
          </button>
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPasswordPrompt(true)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${isAdmin ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {isAdmin ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} 교사 모드
          </button>
        </div>
      </div>

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100">
            <h3 className="text-xl font-black mb-2 flex items-center gap-2 text-indigo-600"><Lock className="w-5 h-5" /> 관리자 접속</h3>
            <p className="text-slate-400 text-xs font-medium mb-6">수업 관리를 위해 비밀번호를 입력하세요. (기본: teacher123)</p>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 mb-4 focus:border-indigo-500 focus:bg-white outline-none transition-all" placeholder="비밀번호 입력" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordPrompt(false)} className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600">닫기</button>
              <button onClick={handleAdminLogin} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold py-3.5 shadow-lg shadow-indigo-100 transition-all">확인</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Input & Feed */}
        <div className="lg:col-span-4 space-y-6">
          {isAdmin ? (
            <section className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center gap-3 mb-6"><Settings className="w-6 h-6 text-indigo-400" /><h2 className="text-xl font-bold">수업 제어판</h2></div>
              <form onSubmit={handleUpdateTopic} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">실시간 질문 내용</label>
                  <input name="topic-input" defaultValue={topic} className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all">질문 변경하기</button>
              </form>
              <div className="mt-6 pt-6 border-t border-slate-800">
                <button onClick={handleClearAll} className="w-full bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 font-bold py-3.5 rounded-2xl border border-rose-900/30 transition-all flex items-center justify-center gap-2"><Eraser className="w-4 h-4" /> 데이터 전체 초기화</button>
              </div>
            </section>
          ) : (
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="mb-8">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">Now Question</span>
                <h2 className="text-2xl font-black text-slate-900 leading-tight mt-3">{topic}</h2>
              </div>
              <div className="space-y-5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">내 답변 참여도</span>
                  <span className={`px-2 py-0.5 rounded-md ${mySubmissionCount >= MAX_SUBMISSIONS ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {mySubmissionCount} / {MAX_SUBMISSIONS}
                  </span>
                </div>
                <textarea 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)} 
                  disabled={mySubmissionCount >= MAX_SUBMISSIONS} 
                  placeholder="짧은 단어나 문장으로 자유롭게 입력하세요..." 
                  className="w-full min-h-[160px] p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none text-lg font-medium" 
                />
                <button 
                  onClick={handleAddData} 
                  disabled={mySubmissionCount >= MAX_SUBMISSIONS || !inputValue.trim()} 
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                >
                  의견 보내기
                </button>
              </div>
            </section>
          )}

          <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-200 h-[420px] flex flex-col">
            <h2 className="text-base font-black flex items-center gap-2 mb-5 text-slate-800"><ClipboardList className="w-5 h-5 text-indigo-500" /> 최근 도착한 의견 ({dataPoints.length})</h2>
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2.5">
              {dataPoints.map(p => (
                <div key={p.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-all animate-in slide-in-from-bottom-3">
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">{p.text}</p>
                  {isAdmin && (
                    <button onClick={() => handleDelete(p.id)} className="text-slate-300 hover:text-rose-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {dataPoints.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-bold">아직 도착한 의견이 없어요.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Visualizations */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[880px]">
            {/* Tabs Header */}
            <div className="px-8 pt-8 pb-4 flex flex-col xl:flex-row justify-between items-center gap-5 border-b border-slate-50">
              <h2 className="text-xl font-black text-slate-900">데이터 시각화 랩</h2>
              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
                {[
                  {id:TabType.TABLE, icon:<TableIcon className="w-4 h-4"/>, label:'표'}, 
                  {id:TabType.CHART, icon:<ChartIcon className="w-4 h-4"/>, label:'그래프'}, 
                  {id:TabType.CLOUD, icon:<Cloud className="w-4 h-4"/>, label:'클라우드'},
                  {id:TabType.ANALYSIS, icon:<Sparkles className="w-4 h-4"/>, label:'AI 통찰'}
                ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id as TabType)} 
                    className={`flex items-center gap-2 py-2.5 px-6 rounded-xl text-sm font-black whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-8">
              {dataPoints.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 py-20">
                  <LayoutDashboard className="w-32 h-32 mb-6" />
                  <p className="text-2xl font-black italic">Waiting for students...</p>
                </div>
              ) : (
                <div className="h-full animate-in fade-in duration-700">
                  {activeTab === TabType.TABLE && (
                    <div className="bg-white rounded-3xl overflow-hidden border border-slate-100">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                            <th className="px-8 py-5">응답 내용</th>
                            <th className="py-5 text-center">득표수</th>
                            <th className="px-8 py-5 text-right">백분율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {frequencyData.map((item, idx) => (
                            <tr key={idx} className="group hover:bg-indigo-50/30 transition-all">
                              <td className="px-8 py-5 font-bold text-slate-800 text-base">{item.name}</td>
                              <td className="py-5 text-center font-black text-indigo-600 text-lg">{item.value}</td>
                              <td className="px-8 py-5 text-right">
                                <span className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 text-xs font-black px-4 py-1.5 rounded-full min-w-[70px]">
                                  {((item.value / dataPoints.length) * 100).toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === TabType.CHART && (
                    <div className="h-full flex flex-col gap-10">
                      <div className="h-[340px] bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Bar Chart - 상위 빈도</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={frequencyData.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11, fontWeight:700, fill:'#94a3b8'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                            <Tooltip 
                              cursor={{fill: 'rgba(99, 102, 241, 0.05)'}} 
                              contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)', padding:'15px'}} 
                            />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={45}>
                              {frequencyData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="h-[400px] bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Pie Chart - 전체 비중</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={frequencyData} 
                              cx="50%" 
                              cy="45%" 
                              innerRadius="60%" 
                              outerRadius="90%" 
                              paddingAngle={6} 
                              dataKey="value" 
                              stroke="none"
                            >
                              {frequencyData.map((_, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius:'15px', border:'none', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{paddingTop:'20px', fontSize:'12px', fontWeight:700}} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {activeTab === TabType.CLOUD && (
                    <div className="h-full flex flex-col gap-6">
                      <div className="flex justify-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl w-fit mx-auto border border-slate-200">
                        {shapes.map(s => (
                          <button 
                            key={s.id} 
                            onClick={() => setCloudShape(s.id)} 
                            className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all ${cloudShape === s.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                      <WordCloud words={frequencyData} shape={cloudShape} />
                    </div>
                  )}

                  {activeTab === TabType.ANALYSIS && (
                    <div className="h-full flex flex-col gap-8 pb-10">
                      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 rounded-[3rem] shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                        <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center shrink-0 border border-white/20">
                          <BrainCircuit className="w-10 h-10 text-white" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <h3 className="text-2xl font-black text-white mb-2">Gemini 3 Flash 분석</h3>
                          <p className="text-indigo-100/80 text-sm font-bold leading-relaxed">우리 반 응답들을 AI가 분석하여 요약해 드립니다.<br/>(최소 3개 이상의 의견이 필요합니다)</p>
                        </div>
                        <button 
                          onClick={handleAIDiagnosis} 
                          disabled={isAnalyzing}
                          className="px-10 py-5 bg-white hover:bg-indigo-50 disabled:bg-indigo-300/30 disabled:text-indigo-200 text-indigo-700 font-black rounded-2xl shadow-2xl transition-all flex items-center gap-3 shrink-0 active:scale-95 group"
                        >
                          {isAnalyzing ? (
                            <div className="w-6 h-6 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                          ) : (
                            <Sparkles className="w-6 h-6 group-hover:animate-bounce" />
                          )}
                          분석 엔진 가동
                        </button>
                      </div>

                      {analysisResult ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-700">
                          <div className={`p-10 rounded-[3rem] border-2 shadow-sm ${analysisResult.sentiment === 'positive' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : analysisResult.sentiment === 'negative' ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
                            <div className="flex items-center justify-between mb-8">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Sentiment Report</span>
                              <div className={`px-5 py-2 rounded-full text-xs font-black uppercase ${analysisResult.sentiment === 'positive' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : analysisResult.sentiment === 'negative' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-500 text-white shadow-lg shadow-slate-200'}`}>
                                {analysisResult.sentiment}
                              </div>
                            </div>
                            <div className="flex items-start gap-5">
                              <Quote className="w-10 h-10 opacity-10 shrink-0 mt-1" />
                              <p className="text-xl font-bold leading-[1.6]">{analysisResult.summary}</p>
                            </div>
                          </div>

                          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-sm flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Key Themes Extracted</span>
                            <div className="flex flex-wrap gap-3">
                              {analysisResult.keyThemes.map((theme, idx) => (
                                <span key={idx} className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-3 border border-indigo-100 hover:scale-105 transition-all cursor-default">
                                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" /> {theme}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : !isAnalyzing && (
                        <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20 gap-4">
                           <Sparkles className="w-16 h-16" />
                           <p className="text-xl font-black">AI가 데이터를 분석할 준비가 되었습니다.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl z-[110] flex items-center gap-4 animate-in slide-in-from-bottom-12 duration-500 border border-slate-700">
          <div className="w-8 h-8 bg-rose-500 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default App;

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Table as TableIcon, PieChart as ChartIcon, Cloud, Trash2, AlertCircle, Settings, 
  ClipboardList, Eraser, LayoutDashboard, Lock,
  MessageSquare, Radio, Sparkles
} from 'lucide-react';
import { initializeApp, getApp, getApps } from "firebase/app";

/**
 * @google/genai 가이드라인에 따라 Firestore 모듈을 정리하여 가져옵니다.
 * "no exported member" 오류를 해결하기 위해 표준 v9 모듈 경로를 확인합니다.
 */
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  getDocs, 
  writeBatch, 
  setDoc 
} from "firebase/firestore";

import { DataPoint, TabType } from './types';
import WordCloud from './components/WordCloud';
import { analyzeData } from './services/geminiService';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
const ADMIN_PASSWORD = "teacher123";

const shapes = [
  { id: 'circle', name: '원형' },
  { id: 'cardioid', name: '하트' },
  { id: 'diamond', name: '하트' }, // diamond shape fallback to heart if not available in library
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
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [mySubmissionCount, setMySubmissionCount] = useState(() => {
    const count = localStorage.getItem('my_submission_count');
    return count ? parseInt(count) : 0;
  });
  
  const [cloudShape, setCloudShape] = useState<string>('circle');
  const MAX_SUBMISSIONS = 5;

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
        console.error("Firestore Error:", err);
        setIsDbConnected(false);
      });

      const unsubscribeTopic = onSnapshot(doc(db, "config", "current_topic"), (doc) => {
        if (doc.exists()) setTopic(doc.data().text);
      });

      return () => {
        unsubscribeResponses();
        unsubscribeTopic();
      };
    }
  }, []);

  const handleIconClick = () => {
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);
    if (newCount >= 5) {
      setShowPasswordPrompt(true);
      setAdminClickCount(0);
    }
    setTimeout(() => setAdminClickCount(0), 3000);
  };

  const handleAdminLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setError("관리자 모드가 활성화되었습니다.");
      setTimeout(() => setError(null), 2000);
    } else {
      setError("암호가 틀렸습니다.");
      setTimeout(() => setError(null), 2000);
    }
  };

  const handleAddData = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    if (!isAdmin && mySubmissionCount >= MAX_SUBMISSIONS) {
      setError(`최대 ${MAX_SUBMISSIONS}번까지만 참여 가능합니다.`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (db) {
      try {
        await addDoc(collection(db, "responses"), { text: trimmed, timestamp: Date.now() });
        setInputValue('');
        if (!isAdmin) {
          const newCount = mySubmissionCount + 1;
          setMySubmissionCount(newCount);
          localStorage.setItem('my_submission_count', newCount.toString());
        }
      } catch (e) {
        setError("서버 연결에 실패했습니다.");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (db) await deleteDoc(doc(db, "responses", id));
  };

  const handleUpdateTopic = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTopic = formData.get('topic-input') as string;
    if (!newTopic || !newTopic.trim()) return;
    if (db) await setDoc(doc(db, "config", "current_topic"), { text: newTopic.trim() });
    setError("질문이 변경되었습니다.");
    setTimeout(() => setError(null), 2000);
  };

  const handleClearAll = async () => {
    if (!confirm("모든 데이터를 초기화할까요?")) return;
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, "responses"));
        const batch = writeBatch(db);
        querySnapshot.forEach(d => batch.delete(doc(db, "responses", d.id)));
        await batch.commit();
        setMySubmissionCount(0);
        localStorage.setItem('my_submission_count', '0');
        setAiResult(null);
      } catch (e) {
        setError("초기화 처리 중 오류가 발생했습니다.");
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // AI 분석 기능을 실행합니다.
  const handleAiAnalyze = async () => {
    if (dataPoints.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeData(dataPoints);
      setAiResult(result);
    } catch (e) {
      setError("AI 분석 도중 문제가 발생했습니다.");
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
      {/* Header with Hidden Access */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleIconClick} 
            className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:scale-110 transition-transform active:scale-95"
          >
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">실시간 학급 설문</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {isDbConnected ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsAdmin(false)} 
            className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            관리자 모드 종료
          </button>
        )}
      </div>

      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full">
            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-600" /> 관리자 암호</h3>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 mb-4 focus:border-indigo-500 outline-none" 
              placeholder="비밀번호" 
              autoFocus 
            />
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordPrompt(false)} className="flex-1 py-4 font-bold text-slate-400">취소</button>
              <button onClick={handleAdminLogin} className="flex-1 bg-indigo-600 text-white rounded-2xl font-bold py-4">확인</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          {isAdmin ? (
            <section className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl">
              <div className="flex items-center gap-3 mb-6 text-indigo-400"><Settings className="w-6 h-6" /><h2 className="text-xl font-bold">수업 설정</h2></div>
              <form onSubmit={handleUpdateTopic} className="space-y-4">
                <input name="topic-input" defaultValue={topic} className="w-full bg-slate-800 border-none rounded-2xl px-4 py-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-4 rounded-2xl transition-all">질문 저장</button>
              </form>
              
              <div className="mt-6 space-y-3">
                <button 
                  onClick={handleAiAnalyze} 
                  disabled={isAnalyzing || dataPoints.length === 0}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {isAnalyzing ? "분석 중..." : <><Sparkles className="w-4 h-4" /> AI 의견 분석</>}
                </button>
                <button onClick={handleClearAll} className="w-full bg-rose-900/30 text-rose-400 font-bold py-4 rounded-2xl border border-rose-900/30 flex items-center justify-center gap-2 hover:bg-rose-900/50 transition-all"><Eraser className="w-4 h-4" /> 전체 초기화</button>
              </div>
            </section>
          ) : (
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h2 className="text-2xl font-black text-slate-900 leading-tight mb-8">{topic}</h2>
              <div className="space-y-5">
                <textarea 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)} 
                  disabled={mySubmissionCount >= MAX_SUBMISSIONS} 
                  placeholder="의견을 입력해 주세요..." 
                  className="w-full min-h-[140px] p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-indigo-500 outline-none transition-all resize-none text-lg" 
                />
                <button 
                  onClick={handleAddData} 
                  disabled={mySubmissionCount >= MAX_SUBMISSIONS || !inputValue.trim()} 
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black py-5 rounded-[2rem] shadow-xl transition-all"
                >
                  제출하기 ({mySubmissionCount}/{MAX_SUBMISSIONS})
                </button>
              </div>
            </section>
          )}

          {/* AI 분석 결과 표시 섹션 */}
          {aiResult && (
            <section className="bg-indigo-50 p-7 rounded-[2.5rem] border border-indigo-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-12 h-12 text-indigo-600" />
              </div>
              <h3 className="text-indigo-900 font-black flex items-center gap-2 mb-4 text-lg">
                <MessageSquare className="w-5 h-5" /> AI 분석 리포트
              </h3>
              <div className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {aiResult}
              </div>
              <button 
                onClick={() => setAiResult(null)} 
                className="mt-4 text-xs font-bold text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                결과 닫기
              </button>
            </section>
          )}

          <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-200 h-[350px] flex flex-col">
            <h2 className="text-base font-black flex items-center gap-2 mb-5"><ClipboardList className="w-5 h-5 text-indigo-500" /> 도착한 의견 ({dataPoints.length})</h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5">
              {dataPoints.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <p className="text-xs font-bold italic">아직 제출된 의견이 없습니다.</p>
                </div>
              ) : (
                dataPoints.map(p => (
                  <div key={p.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white transition-colors">
                    <p className="text-sm font-bold text-slate-700">{p.text}</p>
                    {isAdmin && (
                      <button onClick={() => handleDelete(p.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden min-h-[750px] flex flex-col">
            <div className="px-8 pt-8 pb-4 flex justify-between items-center border-b border-slate-50">
              <h2 className="text-xl font-black">실시간 시각화</h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {[
                  {id:TabType.TABLE, icon:<TableIcon className="w-4 h-4"/>, label:'표'}, 
                  {id:TabType.CHART, icon:<ChartIcon className="w-4 h-4"/>, label:'그래프'}, 
                  {id:TabType.CLOUD, icon:<Cloud className="w-4 h-4"/>, label:'클라우드'}
                ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id as TabType)} 
                    className={`flex items-center gap-2 py-2 px-5 rounded-xl text-sm font-black transition-all ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-8">
              {dataPoints.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <LayoutDashboard className="w-20 h-20 mb-4" />
                  <p className="text-lg font-bold">학생들의 참여를 기다리고 있습니다...</p>
                </div>
              ) : (
                <div className="h-full">
                  {activeTab === TabType.TABLE && (
                    <div className="bg-white rounded-3xl overflow-hidden border border-slate-100">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-8 py-5">항목</th>
                            <th className="py-5 text-center">득표수</th>
                            <th className="px-8 py-5 text-right">비율</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {frequencyData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5 font-bold text-slate-800">{item.name}</td>
                              <td className="py-5 text-center font-black text-indigo-600">{item.value}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400">{((item.value / dataPoints.length) * 100).toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === TabType.CHART && (
                    <div className="h-full flex flex-col gap-10">
                      <div className="h-[300px] bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={frequencyData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11, fontWeight:700, fill:'#94a3b8'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                            <Tooltip contentStyle={{borderRadius:'15px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                              {frequencyData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="h-[350px] bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={frequencyData} 
                              cx="50%" 
                              cy="50%" 
                              innerRadius="60%" 
                              outerRadius="80%" 
                              paddingAngle={5} 
                              dataKey="value"
                              stroke="none"
                            >
                              {frequencyData.map((_, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {activeTab === TabType.CLOUD && (
                    <div className="h-full flex flex-col gap-6">
                      <div className="flex justify-center gap-2">
                        {shapes.map(s => (
                          <button key={s.id} onClick={() => setCloudShape(s.id)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${cloudShape === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {s.name}
                          </button>
                        ))}
                      </div>
                      <WordCloud words={frequencyData} shape={cloudShape} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-[110] flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default App;

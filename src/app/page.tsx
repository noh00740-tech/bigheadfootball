"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Footprints, Zap, Search, SlidersHorizontal, ChevronsUp, BrainCircuit, Trophy, Home as HomeIcon, Menu, ShoppingCart, BarChart3, Flag, BookOpen, Plus, X, Sparkles, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { playHoverSound, playClickSound, playSelectSound, playAnalyzeStartSound, playAnalyzeSuccessSound } from "@/utils/sound";


interface Player {
  id: number;
  name: string;
  nation: string;
  position: string;
  stat_speed: number;
  stat_shoot: number;
  stat_jump: number;
  image_url: string;
}

interface LeaderboardEntry {
  id?: number;
  player_name: string;
  current_streak: number;
  max_streak: number;
  created_at?: string;
}

const nationCodes: { [key: string]: string } = {
  "Korea Republic": "kr",
  "France": "fr",
  "Argentina": "ar",
  "Brazil": "br",
  "England": "gb-eng",
  "Spain": "es",
  "Portugal": "pt",
  "Germany": "de",
  "Japan": "jp",
  "USA": "us",
  "Mexico": "mx",
  "Netherlands": "nl",
  "Norway": "no",
  "Croatia": "hr",
  "Belgium": "be"
};

export default function Home() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [selectedNation, setSelectedNation] = useState("전체");
  const [selectedPosition, setSelectedPosition] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");

  // 프로필 및 리더보드 상태
  const [playerName, setPlayerName] = useState<string>("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [inputName, setInputName] = useState("");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // 설명서 모달 상태
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualActiveTab, setManualActiveTab] = useState<"game" | "profile" | "squad">("game");

  // AI 스쿼드 메이커 상태
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [squadFW, setSquadFW] = useState<Player | null>(null);
  const [squadMF, setSquadMF] = useState<Player | null>(null);
  const [squadDF, setSquadDF] = useState<Player | null>(null);
  const [squadGK, setSquadGK] = useState<Player | null>(null);
  const [selectingPosition, setSelectingPosition] = useState<"FW" | "MF" | "DF" | "GK" | null>("FW");

  // 전술 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    rating: string;
    attack: string;
    defense: string;
    synergy: string;
    summary: string;
  } | null>(null);

  // 리더보드 데이터를 Supabase에서 가져오는 함수
  async function fetchLeaderboard() {
    try {
      setLeaderboardLoading(true);
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("max_streak", { ascending: false })
        .limit(5);

      if (error) {
        console.error("리더보드 로드 중 에러 발생:", error.message);
      } else if (data) {
        setLeaderboardData(data);
      }
    } catch (err) {
      console.error("리더보드 로딩 실패:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  // 플레이어 프로필 저장 처리
  async function handleSaveProfile() {
    const trimmed = inputName.trim();
    if (!trimmed) {
      alert("이름을 입력해 주세요!");
      return;
    }

    try {
      // 1. 이미 등록된 이름인지 확인
      const { data: existingPlayer, error: checkError } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("player_name", trimmed)
        .maybeSingle();

      if (checkError) {
        console.error("중복 체크 중 에러:", checkError.message);
      }

      if (existingPlayer) {
        // 이미 등록되어 있다면 해당 프로필을 불러와 사용
        localStorage.setItem("worldcup_player_name", trimmed);
        setPlayerName(trimmed);
        setIsProfileModalOpen(false);
        alert(`반갑습니다! 기존 플레이어 '${trimmed}' 프로필을 불러왔습니다.`);
        fetchLeaderboard();
        return;
      }

      // 2. 존재하지 않는 이름일 때 신규 등록
      const { error } = await supabase
        .from("leaderboard")
        .insert({
          player_name: trimmed,
          current_streak: 0,
          max_streak: 0
        });

      if (error) {
        console.error("Supabase 리더보드 등록 중 에러 코드:", error.code);
        console.error("Supabase 리더보드 등록 중 에러 메시지:", error.message);
        console.error("Supabase 리더보드 등록 중 에러 세부사항:", error.details);
        console.error("Supabase 리더보드 등록 중 에러 힌트:", error.hint);
        
        alert(`❌ 등록 실패! Supabase 에러 정보:
• 에러 코드: ${error.code}
• 메시지: ${error.message}
• 세부사항: ${error.details || '없음'}
• 힌트: ${error.hint || '없음'}

이 정보를 확인하시고 SQL Editor에서 스크립트를 올바르게 실행했는지 점검해 주세요!`);
        return;
      }

      // 로컬 스토리지 저장 및 상태 갱신
      localStorage.setItem("worldcup_player_name", trimmed);
      setPlayerName(trimmed);
      setIsProfileModalOpen(false);
      alert(`플레이어 프로필 '${trimmed}' 등록이 완료되었습니다!`);
      
      // 실시간 랭킹판 동기화
      fetchLeaderboard();
    } catch (err) {
      console.error("프로필 등록 오류:", err);
      alert("프로필 등록 중 오류가 발생했습니다.");
    }
  }

  // 게스트 플레이 처리
  function handlePlayAsGuest() {
    if (typeof window !== "undefined") {
      localStorage.setItem("worldcup_player_name", "게스트");
    }
    setPlayerName("게스트");
    setIsProfileModalOpen(false);
    alert("게스트 모드로 시작합니다! (경기가 종료되어도 리더보드 연승 랭킹에는 등록되지 않습니다)");
  }

  // 스쿼드 전술 분석 요청
  async function handleAnalyzeSquad() {
    if (!squadFW || !squadMF || !squadDF || !squadGK) {
      alert("4명의 포지션별 선수를 모두 선택해 주세요!");
      return;
    }

    try {
      playAnalyzeStartSound(); // SF 스캔음 재생
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          players: [squadFW, squadMF, squadDF, squadGK],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "분석 요청에 실패했습니다.");
      }

      const result = await response.json();
      setAnalysisResult(result);
      playAnalyzeSuccessSound(); // 성공 알림음 재생
    } catch (err: any) {
      console.error("스쿼드 분석 오류:", err);
      alert(`❌ 분석 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }


  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch("/api/players");
        const data = await res.json();
        if (Array.isArray(data)) {
          setPlayers(data);
          setFilteredPlayers(data);
        }
      } catch (err) {
        console.error("선수 데이터를 불러오는 중 오류 발생:", err);
      } finally {
        setLoading(false);
      }
    }

    // 로컬 스토리지에 저장된 플레이어 이름 복원
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("worldcup_player_name");
      if (saved) {
        setPlayerName(saved);
      }
    }

    fetchPlayers();
    fetchLeaderboard();
  }, []);

  // 필터링 로직
  useEffect(() => {
    let result = players;

    if (selectedNation !== "전체") {
      result = result.filter((p) => p.nation === selectedNation);
    }
    if (selectedPosition !== "전체") {
      result = result.filter((p) => p.position === selectedPosition);
    }
    if (searchQuery.trim() !== "") {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPlayers(result);
  }, [selectedNation, selectedPosition, searchQuery, players]);

  // 고유 국가 목록 추출
  const nations = ["전체", ...Array.from(new Set(players.map((p) => p.nation)))];
  const positions = ["전체", "FW", "MF", "DF", "GK"];

  return (
    <div
      className="w-full min-h-screen relative flex flex-col overflow-x-hidden text-white"
      style={{ backgroundImage: "url('/stadium.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      {/* 연한 어두운 경기장 느낌을 주기 위한 오버레이 레이어 */}
      <div className="absolute inset-0 bg-slate-950/75 z-0 pointer-events-none"></div>

      {/* 백그라운드 프리미엄 오로라 메쉬 글로우 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] rounded-full bg-[#00f5d4]/8 blur-[130px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[60%] rounded-full bg-[#f43f5e]/8 blur-[160px]"></div>
        <div className="absolute top-[30%] right-[-20%] w-[60%] h-[50%] rounded-full bg-purple-500/8 blur-[140px]"></div>
      </div>

      {/* 최상단 WORLD CUP 2026 앱 바 (가로 전체 확장) */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10 h-16 w-full flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full relative">
          {/* 좌측 설명서 버튼 */}
          <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 flex items-center">
            <button 
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-850 hover:to-slate-750 border-2 border-indigo-500/50 hover:border-indigo-400 rounded-xl transition-all duration-300 text-slate-100 hover:scale-[1.03] shadow-[0_0_15px_rgba(99,102,241,0.2)] cursor-pointer"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                setManualActiveTab("game");
                setIsManualModalOpen(true);
              }}
            >
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span className="text-xs md:text-sm font-black whitespace-nowrap tracking-wider">
                게임 설명서
              </span>
            </button>
          </div>

          {/* 중앙 정렬 로고 */}
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl md:text-2xl font-black tracking-widest text-[#f5d0e8] uppercase cursor-pointer whitespace-nowrap"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              router.push("/");
            }}
            style={{ textShadow: "0 0 10px rgba(244, 63, 94, 0.8), 0 0 20px rgba(244, 63, 94, 0.4), 0 0 30px rgba(244, 63, 94, 0.2)" }}
          >
            WORLD CUP 2026
          </span>

          {/* 우측 프로필 아이콘 및 등록 상태 (절대 좌표 우측 고정 배치로 화면 우측에 정렬) */}
          <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <button 
              className="flex items-center gap-2.5 px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-850 hover:to-slate-750 border-2 border-[#00f5d4]/50 hover:border-[#00f5d4] rounded-xl transition-all duration-300 text-slate-100 hover:scale-[1.03] shadow-[0_0_20px_rgba(0,245,212,0.2)] cursor-pointer"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                setInputName(playerName);
                setIsProfileModalOpen(true);
              }}
            >

              <User className="w-5 h-5 text-[#00f5d4] animate-pulse" />
              <span className="text-sm md:text-base font-black whitespace-nowrap tracking-wider">
                {playerName ? `${playerName}님` : "프로필 설정"}
              </span>
            </button>
            
            {/* 프로필 아래 깜빡이는 유도 화살표 (크기 확대) */}
            <div className="absolute top-[56px] flex flex-col items-center animate-bounce pointer-events-none">
              <ChevronsUp className="w-8 h-8 text-[#00f5d4] drop-shadow-[0_0_12px_#00f5d4]" />
              <span className="text-[9px] font-black tracking-widest text-[#00f5d4] uppercase bg-slate-950/80 px-1.5 py-0.5 rounded border border-[#00f5d4]/20 mt-0.5 backdrop-blur-sm shadow-[0_0_10px_rgba(0,245,212,0.1)]">
                PROFILE
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 와이드 컨테이너 */}
      <main className="max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex-1 flex flex-col gap-8 z-10">
        {/* 상단 히어로 배너 */}
        <div className="w-full text-center bg-slate-900/85 border border-white/10 p-8 md:p-12 rounded-3xl backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.05)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none"></div>

          {/* 호스트 국가 배지 */}
          <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 bg-slate-950/60 border border-white/10 rounded-full text-xs font-black tracking-widest text-[#00f5d4] uppercase backdrop-blur-sm">
            <span>🇨🇦 CAN</span>
            <span className="text-slate-600">|</span>
            <span>🇲🇽 MEX</span>
            <span className="text-slate-600">|</span>
            <span>🇺🇸 USA 2026</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-wider leading-none bg-gradient-to-r from-[#00f5d4] to-[#7bf119] bg-clip-text text-transparent text-center uppercase mb-4">
            2026 북중미 월드컵 대두축구 & AI 스쿼드
          </h1>
          <p className="text-slate-300 text-sm md:text-base font-semibold max-w-2xl mx-auto">
            세계 최고의 선수들과 즐기는 대두축구 미니게임과 AI 스쿼드 정밀 분석 서비스
          </p>
        </div>

        {/* 메인 메뉴 선택 영역 (데스크톱 가로 2단, 모바일 세로 1단) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <button
            onClick={() => {
              playClickSound();
              router.push("/game");
            }}
            onMouseEnter={playHoverSound}
            className="group flex flex-col items-center justify-center p-8 bg-slate-900/85 backdrop-blur-md border border-white/10 hover:border-blue-500/50 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(0,245,212,0.3)] cursor-pointer text-center"
          >
            <div className="p-4 bg-rose-500/10 text-[#f43f5e] rounded-full mb-4 group-hover:bg-[#f43f5e] group-hover:text-white transition-all duration-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
              <Trophy className="w-10 h-10" />
            </div>
            <span className="text-2xl font-bold mb-2 text-slate-100 group-hover:text-[#00f5d4] transition-colors">1대1 대두축구 시작</span>
            <span className="text-sm text-slate-400">나의 원픽 월드컵 스타를 골라 단판 승부를 겨뤄보세요!</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setIsSquadModalOpen(true);
              setSelectingPosition("FW");
              setAnalysisResult(null);
            }}
            onMouseEnter={playHoverSound}
            className="group flex flex-col items-center justify-center p-8 bg-slate-900/85 backdrop-blur-md border border-white/10 hover:border-purple-500/50 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(0,245,212,0.3)] cursor-pointer text-center"
          >
            <div className="p-4 bg-[#00f5d4]/10 text-[#00f5d4] rounded-full mb-4 group-hover:bg-[#00f5d4] group-hover:text-black transition-all duration-300 shadow-[0_0_10px_rgba(0,245,212,0.3)]">
              <BrainCircuit className="w-10 h-10" />
            </div>
            <span className="text-2xl font-bold mb-2 text-slate-100 group-hover:text-[#00f5d4] transition-colors">AI 제미나이 스쿼드 메이커</span>
            <span className="text-sm text-slate-400">나만의 드림팀 명단을 짜고 AI 축구 전문가에게 평가를 받으세요!</span>
          </button>
        </div>

        {/* 실시간 연승 랭킹 섹션 */}
        <div className="w-full bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-[0_0_20px_rgba(0,245,212,0.02)]">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-[#00f5d4]">🔥</span> 실시간 연승 랭킹 (Top 5)
          </h3>
          {leaderboardLoading ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <div className="animate-spin inline-block w-5 h-5 border-2 border-[#00f5d4] border-t-transparent rounded-full mb-2"></div>
              <p>실시간 랭킹 데이터를 로드 중...</p>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              현재 등록된 랭커가 없습니다. 첫 랭커로 등록해 보세요!
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboardData.map((entry, index) => {
                const isCurrentUser = entry.player_name === playerName;
                return (
                  <div 
                    key={entry.id || index}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                      isCurrentUser 
                        ? "bg-slate-950/80 border-[#00f5d4]/40 shadow-[0_0_10px_rgba(0,245,212,0.1)]" 
                        : "bg-slate-950/40 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* 순위 배지 */}
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? "bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                        index === 1 ? "bg-slate-300 text-slate-950 shadow-[0_0_8px_rgba(203,213,225,0.4)]" :
                        index === 2 ? "bg-amber-700 text-white shadow-[0_0_8px_rgba(180,83,9,0.4)]" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {index + 1}
                      </span>
                      <span className={`font-bold ${isCurrentUser ? "text-[#00f5d4]" : "text-slate-100"}`}>
                        {entry.player_name} {isCurrentUser && <span className="text-[10px] bg-[#00f5d4]/20 text-[#00f5d4] px-1.5 py-0.5 rounded ml-1.5 font-normal">나</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">최대 연승</div>
                        <div className="text-sm font-black text-[#7bf119]">{entry.max_streak} 연승</div>
                      </div>
                      <div className="w-[1px] h-6 bg-white/10"></div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">현재 연승</div>
                        <div className="text-sm font-black text-rose-400">{entry.current_streak} 연승</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 검색 및 필터 영역 */}
        <div className="w-full space-y-4">
          {/* 검색 바 */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="선수 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 text-slate-100 placeholder-slate-400 backdrop-blur-sm"
            />
          </div>

          {/* 필터 제어 콘트롤 */}
          <div className="bg-slate-900/85 backdrop-blur-sm p-4 rounded-xl border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-400 mr-2 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" /> 국가별:
              </span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full md:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {nations.map((nation) => (
                  <button
                    key={nation}
                    onClick={() => setSelectedNation(nation)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex-shrink-0 ${selectedNation === nation
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                  >
                    {nation}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-400 mr-2 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> 포지션별:
              </span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full md:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex-shrink-0 ${selectedPosition === pos
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 선수단 목록 섹션 */}
        <div className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="inline-block w-3 h-6 bg-[#00f5d4] rounded-full shadow-[0_0_8px_#00f5d4]"></span>
              월드컵 스타 선수 명단 ({filteredPlayers.length}명)
            </h2>
            <button className="text-sm font-semibold text-[#00f5d4] hover:underline flex items-center gap-0.5">
              전체보기 <span className="text-xs">&gt;</span>
            </button>
          </div>

          {/* 로딩 화면 */}
          {loading ? (
            <div className="text-center py-20 text-slate-400">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p>Supabase에서 2026 월드컵 명단을 로딩 중...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-20 text-slate-400 bg-slate-900/85 rounded-2xl border border-dashed border-white/15">
              조건에 맞는 선수가 없습니다. 다른 필터를 선택해 보세요!
            </div>
          ) : (
            /* 선수 카드 격자 그리드 (가로 5열 반응형 격자) */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  onMouseEnter={playHoverSound}
                  className="bg-slate-900/90 backdrop-blur-md border border-white/10 hover:border-[#00f5d4]/40 hover:shadow-[0_0_20px_rgba(0,245,212,0.3)] hover:-translate-y-1 transition-all duration-300 rounded-2xl p-4 md:p-5 relative overflow-hidden group"
                >
                  {/* 포지션 태그 (크기 소폭 줄이고 위치 미세 조정) */}
                  <span className={`absolute top-3.5 right-3.5 text-[10px] font-black px-1.5 py-0.5 rounded ${player.position === 'FW' ? 'bg-red-500/20 text-red-400' :
                      player.position === 'MF' ? 'bg-green-500/20 text-green-400' :
                        player.position === 'GK' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                    }`}>
                    {player.position}
                  </span>

                  <div className="flex items-center gap-3 mb-4">
                    {/* 선수 임시 아바타 (w-14 -> w-12로 줄여 공간 확보) */}
                    <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-800 group-hover:border-[#00f5d4] transition-colors overflow-hidden flex-shrink-0">
                      <img
                        src={`https://flagcdn.com/w160/${nationCodes[player.nation] || 'un'}.png`}
                        alt={`${player.nation} 국기`}
                        className="w-10 h-10 rounded-full object-cover border border-slate-900"
                      />
                    </div>
                    {/* 텍스트 영역에 pr-8을 부여하여 절대 배치된 포지션 배지와 겹침을 원천 차단 */}
                    <div className="overflow-hidden flex-1 pr-8">
                      <h3 className="font-extrabold text-sm md:text-base group-hover:text-[#00f5d4] transition-colors truncate">{player.name}</h3>
                      <p className="text-[10px] md:text-xs text-slate-400 truncate">{player.nation}</p>
                    </div>
                  </div>

                  {/* 능력치 세부 그래프 */}
                  <div className="space-y-2.5 pt-2 border-t border-white/5">
                    <div>
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[#00f5d4]" /> 속도</span>
                        <span className="font-bold text-slate-100">{player.stat_speed}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#00f5d4] h-full rounded-full" style={{ width: `${player.stat_speed}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><Footprints className="w-3.5 h-3.5 text-[#ec4899]" /> 슈팅</span>
                        <span className="font-bold text-slate-100">{player.stat_shoot}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#ec4899] h-full rounded-full" style={{ width: `${player.stat_shoot}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-300 mb-1">
                        <span className="flex items-center gap-1"><ChevronsUp className="w-3.5 h-3.5 text-[#a3ff12]" /> 점프</span>
                        <span className="font-bold text-slate-100">{player.stat_jump}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#a3ff12] h-full rounded-full" style={{ width: `${player.stat_jump}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 하단 네비게이션 바 (모바일 전용, 데스크톱에서는 숨김) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0f1d]/85 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex justify-around items-center">
        <button onClick={() => router.push("/")} className="flex flex-col items-center gap-1 text-[#00f5d4] hover:opacity-80 transition-opacity">
          <HomeIcon className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-widest uppercase">Home</span>
        </button>
        <button onClick={() => alert("🏆 챌린지 모드는 다음 단계에서 업데이트됩니다!")} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#00f5d4] transition-colors">
          <Flag className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-widest uppercase">Challenges</span>
        </button>
        <button onClick={() => alert("📊 리더보드는 다음 단계에서 업데이트됩니다!")} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#00f5d4] transition-colors">
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-widest uppercase">Leaderboard</span>
        </button>
        <button onClick={() => alert("🛒 상점은 다음 단계에서 업데이트됩니다!")} className="flex flex-col items-center gap-1 text-slate-400 hover:text-[#00f5d4] transition-colors">
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] font-black tracking-widest uppercase">Store</span>
        </button>
      </div>

      {/* 프로필 설정 모달 */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl p-12 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
            {/* 상단 포인트 라인 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00f5d4] to-[#7bf119]"></div>

            <h3 className="text-3xl md:text-4xl font-black mb-6 flex items-center gap-4 text-[#00f5d4] tracking-wide">
              <User className="w-9 h-9" /> 프로필 설정
            </h3>
            <p className="text-base text-slate-300 mb-8 leading-relaxed">
              플레이어 이름을 등록하여 실시간 연승 리더보드 랭킹에 도전해 보세요! 다른 기기에서도 동일한 닉네임으로 이어서 플레이가 가능합니다.
            </p>
            <div className="space-y-8">
              <div>
                <label className="block text-base font-bold text-slate-400 mb-3 tracking-wider">플레이어 닉네임</label>
                <input
                  type="text"
                  placeholder="닉네임 입력 (최대 10자)..."
                  maxLength={10}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-5 text-lg md:text-xl focus:outline-none focus:border-[#00f5d4] text-slate-100 placeholder-slate-600 tracking-wide transition-all shadow-inner"
                />
              </div>
              
              <div className="space-y-4 pt-3">
                <button
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    handlePlayAsGuest();
                  }}
                  className="w-full py-4.5 bg-slate-950 hover:bg-slate-900 border-2 border-dashed border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-base md:text-lg font-black rounded-2xl transition-all duration-200 cursor-pointer tracking-wider"
                >
                  😎 게스트로 플레이하기
                </button>

                <div className="flex gap-5">
                  <button
                    onMouseEnter={playHoverSound}
                    onClick={() => {
                      playClickSound();
                      setIsProfileModalOpen(false);
                    }}
                    className="flex-1 py-4.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-base md:text-lg font-black rounded-2xl transition-all duration-200 cursor-pointer uppercase tracking-wider"
                  >
                    취소
                  </button>
                  <button
                    onMouseEnter={playHoverSound}
                    onClick={() => {
                      playClickSound();
                      handleSaveProfile();
                    }}
                    className="flex-1 py-4.5 bg-gradient-to-r from-[#00f5d4] to-[#7bf119] hover:opacity-90 text-slate-950 text-base md:text-lg font-black rounded-2xl transition-all duration-200 cursor-pointer shadow-[0_0_20px_rgba(0,245,212,0.25)] uppercase tracking-wider"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 설명서 모달 */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-slate-900/95 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* 상단 포인트 라인 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-[#00f5d4]"></div>

            {/* 헤더 및 닫기 버튼 */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h3 className="text-xl md:text-2xl font-black flex items-center gap-2.5 text-indigo-400 tracking-wide">
                <BookOpen className="w-6 h-6" /> WORLD CUP 2026 게임 가이드
              </h3>
              <button 
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setIsManualModalOpen(false);
                }}
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg text-sm cursor-pointer"
              >
                닫기 ✕
              </button>
            </div>

            {/* 탭 스위처 (가로 배열) */}
            <div className="flex border-b border-white/5 mb-6 gap-2">
              <button
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setManualActiveTab("game");
                }}
                className={`flex-1 md:flex-none px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-all duration-200 cursor-pointer ${
                  manualActiveTab === "game"
                    ? "border-indigo-400 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                🎮 게임 방법 & 조작법
              </button>
              <button
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setManualActiveTab("profile");
                }}
                className={`flex-1 md:flex-none px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-all duration-200 cursor-pointer ${
                  manualActiveTab === "profile"
                    ? "border-purple-400 text-purple-400 bg-purple-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                👤 프로필 설정 & 연승 랭킹
              </button>
              <button
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setManualActiveTab("squad");
                }}
                className={`flex-1 md:flex-none px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-all duration-200 cursor-pointer ${
                  manualActiveTab === "squad"
                    ? "border-[#00f5d4] text-[#00f5d4] bg-[#00f5d4]/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                🤖 AI 스쿼드 메이커
              </button>
            </div>

            {/* 탭 내용 영역 (스크롤 가능) */}
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {manualActiveTab === "game" && (
                <div className="space-y-6 text-slate-300 leading-relaxed text-sm md:text-base">
                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span> 1대1 대두축구 경기 규칙
                    </h4>
                    <p className="text-slate-400 pl-3">
                      본인이 고른 2026 월드컵 스타 선수와 AI 봇이 맞붙는 1대1 박진감 넘치는 캐주얼 축구 게임입니다.
                      제한 시간 동안 경기가 진행되며, <strong className="text-indigo-300">먼저 5골을 득점하는 플레이어</strong>가 승리하게 됩니다.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span> 키보드 조작 방법
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-3 mt-3">
                      <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5">
                        <div className="font-bold text-white mb-2.5 text-xs tracking-wider text-indigo-400">⬅️ 이동 조작</div>
                        <div className="space-y-1.5 text-slate-400 text-xs md:text-sm">
                          <p><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">A</kbd> 또는 <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">←</kbd> : 왼쪽으로 이동</p>
                          <p><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">D</kbd> 또는 <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">→</kbd> : 오른쪽으로 이동</p>
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5">
                        <div className="font-bold text-white mb-2.5 text-xs tracking-wider text-indigo-400">⬆️ 점프 조작</div>
                        <div className="space-y-1.5 text-slate-400 text-xs md:text-sm">
                          <p><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">W</kbd> 또는 <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">Space</kbd> 또는 <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">↑</kbd> : 위로 점프</p>
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5">
                        <div className="font-bold text-white mb-2.5 text-xs tracking-wider text-indigo-400">⏸️ 일시정지 조작</div>
                        <div className="space-y-1.5 text-slate-400 text-xs md:text-sm">
                          <p><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono border border-white/10 mr-1.5">ESC</kbd> : 게임 일시정지 / 재개</p>
                          <p>또는 화면 상단의 <span className="text-amber-400 font-bold">일시정지 버튼</span> 클릭</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span> 슛과 헤더 메커니즘
                    </h4>
                    <p className="text-slate-400 pl-3">
                      이 게임은 별도의 슈팅 단축키가 없습니다! 대신 플레이어 캐릭터의 거대한 대두와 발을 공에 충돌시키는 물리엔진을 사용하여 슛을 발사합니다.
                      선수의 <span className="text-[#ec4899] font-bold">슈팅(Shoot) 스탯</span>이 높을수록 부딪쳤을 때 공이 날아가는 파워가 증가하며, 충돌 시의 각도와 점프 높이에 따라 낙차 큰 슛이나 강력한 헤더가 가능합니다.
                    </p>
                  </div>
                </div>
              )}

              {manualActiveTab === "profile" && (
                <div className="space-y-6 text-slate-300 leading-relaxed text-sm md:text-base">
                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-purple-400 rounded-full"></span> 플레이어 프로필 등록 및 로그인
                    </h4>
                    <p className="text-slate-400 pl-3">
                      메인화면 우측 상단의 <strong className="text-purple-300">[프로필 설정]</strong> 버튼을 이용해 본인만의 닉네임을 설정하세요.
                      만약 기존에 사용하던 닉네임을 입력하는 경우, 중복 에러가 발생하는 대신 <span className="text-emerald-400">이전 기록을 안전하게 불러와 연동 로그인</span>됩니다.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-purple-400 rounded-full"></span> 실시간 연승 랭킹 및 데이터베이스 연동
                    </h4>
                    <p className="text-slate-400 pl-3">
                      프로필이 등록된 상태에서 AI와의 단판 대결에 승리할 시 연승 기록이 누적됩니다.
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-5 mt-2 text-xs md:text-sm">
                      <li>승리(Win) 시: 현재 연승이 1 증가하고, 최대 연승 기록을 돌파하면 최대 기록도 같이 자동 갱신됩니다.</li>
                      <li>패배(Lose) 시: 현재 연승이 0으로 리셋되며, 기록된 최대 연승은 영구 보존됩니다.</li>
                      <li>갱신된 기록은 메인 화면의 <strong className="text-white">실시간 연승 랭킹 (Top 5)</strong>판에 즉시 업데이트되어 다른 유저들과 경쟁할 수 있습니다.</li>
                    </ul>
                  </div>
                </div>
              )}

              {manualActiveTab === "squad" && (
                <div className="space-y-6 text-slate-300 leading-relaxed text-sm md:text-base">
                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-[#00f5d4] rounded-full"></span> 4인 드림팀 스쿼드 구성
                    </h4>
                    <p className="text-slate-400 pl-3">
                      월드컵 최고의 전사들 중 포지션별(FW, MF, DF, GK)로 각각 단 1명씩만 엄선하여 나만의 4인 스쿼드를 구축합니다.
                      상단 슬롯을 클릭한 후, 명단에 있는 원하는 선수를 클릭하면 해당 포지션 슬롯에 즉시 매칭됩니다.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-[#00f5d4] rounded-full"></span> 구글 제미나이 3.5 플래시 전술 분석
                    </h4>
                    <p className="text-slate-400 pl-3">
                      4명의 선수 배치가 완료되면 분석기가 활성화됩니다.
                      구글 최신 <span className="text-[#00f5d4] font-bold">Gemini 3.5 Flash</span> 인공지능이 선수들의 개별 스탯(속도, 슈팅, 점프)과 국가 조합 시너지를 정밀하게 계산해 전문가처럼 평가를 내려줍니다.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-4 bg-[#00f5d4] rounded-full"></span> 스쿼드 평점 및 결과 보고서
                    </h4>
                    <p className="text-slate-400 pl-3">
                      제미나이가 산정한 팀의 최종 등급(S, A, B, C, D)과 부문별 전술 분석(공격 성향, 수비 안정성, 예상 시너지, 감독 총평) 결과가 출력됩니다. 
                      언제든지 "스쿼드 재구성하기"를 통해 더 강력한 전술 조합을 실험해 볼 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 닫기 단추 */}
            <div className="pt-4 border-t border-white/10 mt-6 flex justify-end">
              <button
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setIsManualModalOpen(false);
                }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl transition-all duration-200 cursor-pointer text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 스쿼드 메이커 모달 */}
      {isSquadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-slate-900/95 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200 relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* 상단 포인트 라인 */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-[#00f5d4]"></div>

            {/* 헤더 및 닫기 버튼 */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6 flex-shrink-0">
              <div>
                <h3 className="text-xl md:text-2xl font-black flex items-center gap-2.5 text-purple-400 tracking-wide">
                  <BrainCircuit className="w-6 h-6 text-[#00f5d4] animate-pulse" /> AI 제미나이 스쿼드 메이커
                </h3>
                <p className="text-xs text-slate-400 mt-1">포지션별 최고의 4인 드림팀을 구성하여 전술 평가를 받아보세요.</p>
              </div>
              <button 
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setIsSquadModalOpen(false);
                  setSquadFW(null);
                  setSquadMF(null);
                  setSquadDF(null);
                  setSquadGK(null);
                  setAnalysisResult(null);
                }}
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg text-sm cursor-pointer"
              >
                닫기 ✕
              </button>
            </div>

            {/* 메인 스크롤 가능 컨텐츠 영역 */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {/* 4인 슬롯 레이아웃 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative overflow-hidden p-1 rounded-2xl">
                {isAnalyzing && (
                  <div className="absolute w-full h-[3px] bg-gradient-to-r from-transparent via-[#00f5d4] to-transparent shadow-[0_0_12px_#00f5d4] left-0 animate-scan pointer-events-none z-10" />
                )}
                {/* FW SLOT */}
                <div 
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSelectingPosition("FW");
                  }}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center ${
                    selectingPosition === "FW" 
                      ? "border-purple-500 bg-purple-500/5 shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                      : squadFW ? "border-[#00f5d4]/40 bg-slate-950/40 hover:border-[#00f5d4]" : "border-dashed border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="absolute top-2 left-2 text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">FW</span>
                  {squadFW ? (
                    <div className="text-center w-full relative">
                      <button 
                        onMouseEnter={playHoverSound}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          setSquadFW(null);
                        }}
                        className="absolute -top-1 -right-1 p-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-full transition-colors cursor-pointer z-20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img 
                        src={`https://flagcdn.com/w160/${nationCodes[squadFW.nation] || 'un'}.png`} 
                        className="w-10 h-10 rounded-full mx-auto object-cover border border-slate-700 mb-2" 
                      />
                      <div className="font-extrabold text-sm text-slate-100 truncate">{squadFW.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{squadFW.nation}</div>
                      <div className="flex justify-center gap-1.5 mt-1.5 text-[9px] font-mono text-slate-300">
                        <span>속:{squadFW.stat_speed}</span>
                        <span>슛:{squadFW.stat_shoot}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Plus className="w-5 h-5 mx-auto mb-1 opacity-60 text-purple-400" />
                      <span className="text-xs font-bold">공격수 선택</span>
                    </div>
                  )}
                </div>

                {/* MF SLOT */}
                <div 
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSelectingPosition("MF");
                  }}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center ${
                    selectingPosition === "MF" 
                      ? "border-indigo-500 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                      : squadMF ? "border-[#00f5d4]/40 bg-slate-950/40 hover:border-[#00f5d4]" : "border-dashed border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="absolute top-2 left-2 text-[10px] font-black text-green-400 bg-green-500/10 px-2 py-0.5 rounded">MF</span>
                  {squadMF ? (
                    <div className="text-center w-full relative">
                      <button 
                        onMouseEnter={playHoverSound}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          setSquadMF(null);
                        }}
                        className="absolute -top-1 -right-1 p-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-full transition-colors cursor-pointer z-20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img 
                        src={`https://flagcdn.com/w160/${nationCodes[squadMF.nation] || 'un'}.png`} 
                        className="w-10 h-10 rounded-full mx-auto object-cover border border-slate-700 mb-2" 
                      />
                      <div className="font-extrabold text-sm text-slate-100 truncate">{squadMF.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{squadMF.nation}</div>
                      <div className="flex justify-center gap-1.5 mt-1.5 text-[9px] font-mono text-slate-300">
                        <span>속:{squadMF.stat_speed}</span>
                        <span>슛:{squadMF.stat_shoot}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Plus className="w-5 h-5 mx-auto mb-1 opacity-60 text-indigo-400" />
                      <span className="text-xs font-bold">미드필더 선택</span>
                    </div>
                  )}
                </div>

                {/* DF SLOT */}
                <div 
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSelectingPosition("DF");
                  }}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center ${
                    selectingPosition === "DF" 
                      ? "border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                      : squadDF ? "border-[#00f5d4]/40 bg-slate-950/40 hover:border-[#00f5d4]" : "border-dashed border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="absolute top-2 left-2 text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">DF</span>
                  {squadDF ? (
                    <div className="text-center w-full relative">
                      <button 
                        onMouseEnter={playHoverSound}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          setSquadDF(null);
                        }}
                        className="absolute -top-1 -right-1 p-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-full transition-colors cursor-pointer z-20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img 
                        src={`https://flagcdn.com/w160/${nationCodes[squadDF.nation] || 'un'}.png`} 
                        className="w-10 h-10 rounded-full mx-auto object-cover border border-slate-700 mb-2" 
                      />
                      <div className="font-extrabold text-sm text-slate-100 truncate">{squadDF.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{squadDF.nation}</div>
                      <div className="flex justify-center gap-1.5 mt-1.5 text-[9px] font-mono text-slate-300">
                        <span>속:{squadDF.stat_speed}</span>
                        <span>점:{squadDF.stat_jump}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Plus className="w-5 h-5 mx-auto mb-1 opacity-60 text-blue-400" />
                      <span className="text-xs font-bold">수비수 선택</span>
                    </div>
                  )}
                </div>

                {/* GK SLOT */}
                <div 
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSelectingPosition("GK");
                  }}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center ${
                    selectingPosition === "GK" 
                      ? "border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
                      : squadGK ? "border-[#00f5d4]/40 bg-slate-950/40 hover:border-[#00f5d4]" : "border-dashed border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="absolute top-2 left-2 text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">GK</span>
                  {squadGK ? (
                    <div className="text-center w-full relative">
                      <button 
                        onMouseEnter={playHoverSound}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          setSquadGK(null);
                        }}
                        className="absolute -top-1 -right-1 p-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-full transition-colors cursor-pointer z-20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img 
                        src={`https://flagcdn.com/w160/${nationCodes[squadGK.nation] || 'un'}.png`} 
                        className="w-10 h-10 rounded-full mx-auto object-cover border border-slate-700 mb-2" 
                      />
                      <div className="font-extrabold text-sm text-slate-100 truncate">{squadGK.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{squadGK.nation}</div>
                      <div className="flex justify-center gap-1.5 mt-1.5 text-[9px] font-mono text-slate-300">
                        <span>점:{squadGK.stat_jump}</span>
                        <span>슛:{squadGK.stat_shoot}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500">
                      <Plus className="w-5 h-5 mx-auto mb-1 opacity-60 text-amber-400" />
                      <span className="text-xs font-bold">골키퍼 선택</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 탭 기반 콘텐츠: 결과 노출 중이 아닐 때는 선수 리스트를 노출 */}
              {analysisResult === null && !isAnalyzing ? (
                <div className="border-t border-white/5 pt-5 flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-black text-slate-200">
                      ⚽ {selectingPosition} 포지션 선수 명단 
                    </h4>
                  </div>

                  {/* 모달 내부 포지션 필터링 선수단 그리드 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {players
                      .filter((p) => p.position === selectingPosition)
                      .map((p) => {
                        const isSelected = squadFW?.id === p.id || squadMF?.id === p.id || squadDF?.id === p.id || squadGK?.id === p.id;
                        return (
                          <div
                            key={p.id}
                            onMouseEnter={playHoverSound}
                            onClick={() => {
                              if (isSelected) return;
                              playSelectSound(); // 장착 효과음 재생
                              // 포지션별 셋업 및 자동 다음 포지션 이동
                              if (selectingPosition === "FW") {
                                setSquadFW(p);
                                setSelectingPosition("MF");
                              } else if (selectingPosition === "MF") {
                                setSquadMF(p);
                                setSelectingPosition("DF");
                              } else if (selectingPosition === "DF") {
                                setSquadDF(p);
                                setSelectingPosition("GK");
                              } else if (selectingPosition === "GK") {
                                setSquadGK(p);
                                setSelectingPosition(null);
                              }
                            }}
                            className={`p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 cursor-pointer ${
                              isSelected 
                                ? "bg-slate-950/20 border-white/5 opacity-40 cursor-not-allowed" 
                                : "bg-slate-950/60 border-white/10 hover:border-[#00f5d4]/60 hover:bg-slate-900/80 hover:shadow-[0_0_15px_rgba(0,245,212,0.2)] hover:-translate-y-0.5"
                            }`}
                          >
                            <img 
                              src={`https://flagcdn.com/w160/${nationCodes[p.nation] || 'un'}.png`} 
                              className="w-8 h-8 rounded-full object-cover border border-slate-800" 
                            />
                            <div className="overflow-hidden flex-1">
                              <div className="font-extrabold text-xs text-slate-100 truncate">{p.name}</div>
                              <div className="text-[9px] text-slate-500 truncate">{p.nation}</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {/* 전술 분석 로딩 화면 */}
              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 border-t border-white/5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-purple-400 animate-spin"></div>
                  </div>
                  <h4 className="text-lg font-black text-slate-200 animate-pulse">제미나이가 전술 판을 분석 중입니다...</h4>
                  <p className="text-xs text-slate-500">스쿼드의 스탯 밸런스 및 국가 연동 시너지를 평가하고 있습니다.</p>
                </div>
              )}

              {/* 분석 결과 출력 창 */}
              {analysisResult && (
                <div className="border-t border-white/5 pt-5 space-y-6 animate-fade-in-up">
                  <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-950/40 border border-purple-500/20 rounded-2xl p-6 md:p-8 backdrop-blur-md">
                    {/* 평점 메달 배지 */}
                    <div className="flex-shrink-0 text-center">
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">종합 스쿼드 평점</div>
                      <div className={`w-28 h-28 rounded-full flex items-center justify-center font-black text-6xl shadow-2xl relative ${
                        analysisResult.rating === "S" ? "bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow-yellow-500/20 border-4 border-yellow-300 animate-pulse" :
                        analysisResult.rating === "A" ? "bg-gradient-to-tr from-slate-300 to-white text-slate-950 shadow-slate-300/20 border-4 border-slate-200" :
                        analysisResult.rating === "B" ? "bg-gradient-to-tr from-amber-700 to-orange-400 text-white shadow-orange-500/20 border-4 border-orange-500" :
                        "bg-slate-800 text-slate-300 border-4 border-slate-700"
                      }`}>
                        {analysisResult.rating}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <h4 className="text-xl font-black text-purple-400 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400" /> 제미나이의 전술 총평
                      </h4>
                      <p className="text-slate-200 font-bold text-sm md:text-base leading-relaxed">
                        {analysisResult.summary}
                      </p>
                    </div>
                  </div>

                  {/* 세부 분석 내용 그리드 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 공격성향 카드 */}
                    <div className="bg-slate-950/30 border border-rose-500/15 p-5 rounded-2xl space-y-2.5">
                      <div className="font-extrabold text-sm text-rose-400 flex items-center gap-1.5 uppercase">
                        <Footprints className="w-4 h-4" /> ⚔️ 공격 성향
                      </div>
                      <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-semibold">
                        {analysisResult.attack}
                      </p>
                    </div>

                    {/* 수비안정성 카드 */}
                    <div className="bg-slate-950/30 border border-blue-500/15 p-5 rounded-2xl space-y-2.5">
                      <div className="font-extrabold text-sm text-blue-400 flex items-center gap-1.5 uppercase">
                        <Shield className="w-4 h-4" /> 🛡️ 수비 안정성
                      </div>
                      <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-semibold">
                        {analysisResult.defense}
                      </p>
                    </div>

                    {/* 시너지효과 카드 */}
                    <div className="bg-slate-950/30 border border-green-500/15 p-5 rounded-2xl space-y-2.5">
                      <div className="font-extrabold text-sm text-green-400 flex items-center gap-1.5 uppercase">
                        <Zap className="w-4 h-4" /> ⚡ 예상 시너지
                      </div>
                      <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-semibold">
                        {analysisResult.synergy}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 제어부 및 분석 신청 버튼 */}
            <div className="pt-4 border-t border-white/10 mt-6 flex gap-4 justify-end flex-shrink-0">
              {analysisResult ? (
                <button
                  onMouseEnter={playHoverSound}
                  onClick={() => {
                    playClickSound();
                    setSquadFW(null);
                    setSquadMF(null);
                    setSquadDF(null);
                    setSquadGK(null);
                    setAnalysisResult(null);
                    setSelectingPosition("FW");
                  }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold rounded-xl transition-all duration-200 cursor-pointer text-sm tracking-wider"
                >
                  🔄 스쿼드 재구성하기
                </button>
              ) : null}

              {!analysisResult && !isAnalyzing && (
                <button
                  onMouseEnter={playHoverSound}
                  onClick={handleAnalyzeSquad}
                  disabled={!squadFW || !squadMF || !squadDF || !squadGK}
                  className={`px-8 py-3 text-sm font-black rounded-xl transition-all duration-350 tracking-wider flex items-center gap-2 cursor-pointer ${
                    squadFW && squadMF && squadDF && squadGK
                      ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-[#00f5d4] hover:opacity-95 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:scale-[1.02]"
                      : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                  }`}
                >
                  🔥 제미나이 AI 전술 분석 받기
                </button>
              )}

              <button
                onMouseEnter={playHoverSound}
                onClick={() => {
                  playClickSound();
                  setIsSquadModalOpen(false);
                  setSquadFW(null);
                  setSquadMF(null);
                  setSquadDF(null);
                  setSquadGK(null);
                  setAnalysisResult(null);
                }}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold rounded-xl transition-all duration-200 cursor-pointer text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

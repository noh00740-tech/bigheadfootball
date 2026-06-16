"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { User, Footprints, Zap, ChevronsUp, Swords, ArrowLeft, Play, Pause, Flame, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

type GameState = "SELECT" | "PLAYING" | "GAMEOVER";

export default function GamePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>("SELECT");

  // 플레이어 선택 상태
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [aiPlayerId, setAiPlayerId] = useState<number | null>(null);

  // 국가 필터 선택 상태
  const [p1SelectedNation, setP1SelectedNation] = useState<string>("전체");
  const [p2SelectedNation, setP2SelectedNation] = useState<string>("전체");

  // 중복 없는 국가 리스트 추출
  const nations = ["전체", ...Array.from(new Set(players.map((p) => p.nation)))];

  // 국가 선택 변경 및 선수 ID 자동 리셋 핸들러
  const handleP1NationChange = (nation: string) => {
    setP1SelectedNation(nation);
    const filtered = players.filter((p) => nation === "전체" || p.nation === nation);
    if (filtered.length > 0) {
      setMyPlayerId(filtered[0].id);
    }
  };

  const handleP2NationChange = (nation: string) => {
    setP2SelectedNation(nation);
    const filtered = players.filter((p) => nation === "전체" || p.nation === nation);
    if (filtered.length > 0) {
      setAiPlayerId(filtered[0].id);
    }
  };

  // 게임 스코어 및 결과 상태
  const [myScore, setMyScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [winner, setWinner] = useState<"USER" | "AI" | null>(null);
  const [playerStreakInfo, setPlayerStreakInfo] = useState<{ current: number; max: number } | null>(null);

  // Canvas 및 키 입력 레퍼런스
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<{ [key: string]: boolean }>({});

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  const togglePause = () => {
    if (gameState !== "PLAYING") return;
    const nextPaused = !isPausedRef.current;
    isPausedRef.current = nextPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      keys.current = {};
    }
  };

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch("/api/players");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPlayers(data);
          
          // 무작위로 2명의 선수 추출
          const randomIndex1 = Math.floor(Math.random() * data.length);
          let randomIndex2 = Math.floor(Math.random() * data.length);
          if (data.length > 1) {
            while (randomIndex2 === randomIndex1) {
              randomIndex2 = Math.floor(Math.random() * data.length);
            }
          }
          
          const p1 = data[randomIndex1];
          const p2 = data[randomIndex2];
          
          setMyPlayerId(p1.id);
          setP1SelectedNation(p1.nation);
          
          setAiPlayerId(p2.id);
          setP2SelectedNation(p2.nation);
        }
      } catch (err) {
        console.error("게임 선수 목록 로딩 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const aiPlayer = players.find((p) => p.id === aiPlayerId);

  const handleStartGame = () => {
    if (!myPlayerId || !aiPlayerId) {
      alert("선수를 선택해 주세요!");
      return;
    }
    setMyScore(0);
    setAiScore(0);
    setWinner(null);
    setPlayerStreakInfo(null);
    setIsPaused(false);
    isPausedRef.current = false;
    setGameState("PLAYING");
  };

  const updateLeaderboardStreak = async (userWon: boolean) => {
    if (typeof window === "undefined") return;
    const name = localStorage.getItem("worldcup_player_name");
    if (!name || name === "게스트") {
      console.log("플레이어 프로필 이름이 등록되지 않았거나 게스트 상태이므로 리더보드를 업데이트하지 않습니다.");
      return;
    }

    try {
      // 1. 현재 데이터베이스에 저장되어 있는 플레이어 레코드 조회
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("player_name", name)
        .maybeSingle();

      if (error) {
        console.error("리더보드 조회 중 오류:", error.message);
        return;
      }

      let currentStreak = 0;
      let maxStreak = 0;

      if (data) {
        // 이미 랭커 레코드가 존재하는 경우
        currentStreak = data.current_streak;
        maxStreak = data.max_streak;

        if (userWon) {
          currentStreak += 1;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          currentStreak = 0; // AI에게 지면 현재 연승 리셋
        }

        const { error: updateError } = await supabase
          .from("leaderboard")
          .update({
            current_streak: currentStreak,
            max_streak: maxStreak
          })
          .eq("player_name", name);

        if (updateError) {
          console.error("리더보드 업데이트 중 오류:", updateError.message);
        } else {
          console.log(`리더보드 업데이트 완료: ${name} - 현재 ${currentStreak}연승 (최대 ${maxStreak}연승)`);
          setPlayerStreakInfo({ current: currentStreak, max: maxStreak });
        }
      } else {
        // 혹시라도 레코드가 아직 존재하지 않는 경우 (예외 처리)
        if (userWon) {
          currentStreak = 1;
          maxStreak = 1;
        } else {
          currentStreak = 0;
          maxStreak = 0;
        }

        const { error: insertError } = await supabase
          .from("leaderboard")
          .insert({
            player_name: name,
            current_streak: currentStreak,
            max_streak: maxStreak
          });

        if (insertError) {
          console.error("리더보드 삽입 중 오류:", insertError.message);
        } else {
          setPlayerStreakInfo({ current: currentStreak, max: maxStreak });
        }
      }
    } catch (err) {
      console.error("리더보드 갱신 예외 발생:", err);
    }
  };

  // 게임 종료 시 연승 기록 자동 갱신 트리거
  useEffect(() => {
    if (gameState === "GAMEOVER" && winner) {
      updateLeaderboardStreak(winner === "USER");
    }
  }, [gameState, winner]);

  // HTML5 Canvas 게임 물리 루프
  useEffect(() => {
    if (gameState !== "PLAYING" || !myPlayer || !aiPlayer) return;

    // 게임 시작 시 브라우저 윈도우 포커스 자동 부여
    window.focus();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 게임 물리 변수 설정
    const ground = 400;
    const gravity = 0.6;
    const bounce = 0.86; // 공중 매치업 활성화를 위해 반발력 대폭 상향 (기존 0.70 -> 0.86)

    // 플레이어 스탯 보너스 적용 공식
    // 이동속도: base(4) + stat * 0.045
    const userSpeed = 4 + (myPlayer.stat_speed * 0.045);
    // 점프력: base(9.5) + stat * 0.05 (음수 처리하여 위쪽 발사 속도)
    const userJumpForce = -(9.5 + (myPlayer.stat_jump * 0.05));

    const aiSpeed = 3.5 + (aiPlayer.stat_speed * 0.04);
    const aiJumpForce = -(9.5 + (aiPlayer.stat_jump * 0.05));

    const user = {
      x: 200, // 기존 180 -> 200
      y: ground - 35,
      vx: 0,
      vy: 0,
      radius: 35,
      speed: userSpeed,
      jumpForce: userJumpForce,
      stat_shoot: myPlayer.stat_shoot,
      name: myPlayer.name,
      nation: myPlayer.nation,
    };

    const ai = {
      x: 800, // 기존 620 -> 800
      y: ground - 35,
      vx: 0,
      vy: 0,
      radius: 35,
      speed: aiSpeed,
      jumpForce: aiJumpForce,
      stat_shoot: aiPlayer.stat_shoot,
      name: aiPlayer.name,
      nation: aiPlayer.nation,
    };

    const ball = {
      x: 500,
      y: 30, // 하늘 끝에서 툭 떨어지도록 Y=30으로 설정
      vx: 0,
      vy: 0,
      radius: 28, // 공 크기 기존 22px에서 28px로 추가 확대
    };

    let userScoreLocal = 0;
    let aiScoreLocal = 0;
    let goalText = "";
    let goalTimer = 0; // 골 득점 후 일시정지 타이머 (프레임 단위)

    // AI 밸런스 패치용 로컬 변수
    let aiBallOnHeadTimer = 0;
    let aiTargetOffset = 0;
    let aiOffsetTimer = 0;
    let aiStunTimer = 0; // AI 충돌 경직 타이머

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        const nextPaused = !isPausedRef.current;
        isPausedRef.current = nextPaused;
        setIsPaused(nextPaused);
        if (nextPaused) {
          keys.current = {};
        }
        return;
      }

      if (isPausedRef.current) return;

      keys.current[e.code] = true;
      // 스페이스바(" ") 및 방향키 등의 스크롤 기본 동작 원천 차단
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " ", "KeyW", "KeyS", "KeyA", "KeyD"].includes(e.key) || 
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyS", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    // 포커스 이탈 시 stuck key 방지 핸들러
    const handleBlur = () => {
      keys.current = {};
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    const resetPositions = () => {
      user.x = 200; // 기존 180 -> 200
      user.y = ground - user.radius;
      user.vx = 0;
      user.vy = 0;

      ai.x = 800; // 기존 620 -> 800
      ai.y = ground - ai.radius;
      ai.vx = 0;
      ai.vy = 0;

      ball.x = 500; // 기존 400 -> 500
      ball.y = 30; // 하늘 끝에서 툭 떨어지도록 Y=30으로 설정
      ball.vx = 0;
      ball.vy = 0;
    };

    let animationFrameId: number;

    const updateGame = () => {
      if (isPausedRef.current) return;

      if (goalTimer > 0) {
        goalTimer--;
        if (goalTimer === 0) {
          resetPositions();
          goalText = "";
        }
        return; // 골 득점 후 정지 상태
      }

      // --- 1. 유저 이동 (방향키 왼쪽/오른쪽, 점프: 위쪽 또는 Space) ---
      const isGrounded = user.y >= ground - user.radius;

      if (keys.current["ArrowLeft"] || keys.current["KeyA"]) {
        user.vx = -user.speed;
      } else if (keys.current["ArrowRight"] || keys.current["KeyD"]) {
        user.vx = user.speed;
      } else {
        // 공중에서는 마찰력(공기저항)을 줄여 부드러운 포물선을 그리며 관성 비행하도록 설정
        user.vx *= isGrounded ? 0.8 : 0.95;
      }

      if ((keys.current["ArrowUp"] || keys.current["Space"] || keys.current["KeyW"]) && isGrounded) {
        user.vy = user.jumpForce;
      }

      // 유저 중력 및 좌표 적용
      user.vy += gravity;
      user.x += user.vx;
      user.y += user.vy;

      // --- 2. AI 동작 (공 추적 & 점프 슛 봇 로직) ---
      const aiGrounded = ai.y >= ground - ai.radius;

      // 15프레임마다(약 0.25초) AI 추적 오차를 업데이트 (-15px ~ +15px)
      aiOffsetTimer++;
      if (aiOffsetTimer > 15) {
        aiTargetOffset = (Math.random() - 0.5) * 30; // -15px ~ +15px
        aiOffsetTimer = 0;
      }
      
      // 위험 구역(X > 850)에서는 인간적 실수 오차를 배제하고 실시간 공 위치(ball.x)를 정밀 추적
      const isDangerZone = ball.x > 850;
      const targetX = isDangerZone ? ball.x : ball.x + aiTargetOffset;
      const activeSpeed = isDangerZone ? ai.speed * 1.25 : ai.speed;

      // 기회주의적 공격 감지: 공이 유저 진영(X < 500)에서 거의 정지해 있을 때
      const isBallStoppedInUserHalf = (Math.abs(ball.vx) < 0.5 && Math.abs(ball.vy) < 0.5) && ball.x < 500;
      
      // 수비 복귀 판정: 공이 유저 진영(X <= 400)에 있고, 멈춰있지 않으며, AI가 중앙선 우측(X >= 500)에 있을 때만 복귀
      const shouldRetreat = (ball.x <= 400) && !isBallStoppedInUserHalf && (ai.x >= 500);

      // 공의 위치 및 공격 상태에 따른 AI 조작 상태 분기
      if (shouldRetreat) {
        // 수비 진영(780~820)으로 복귀
        if (ai.x > 820) {
          ai.vx = -activeSpeed;
        } else if (ai.x < 780) {
          ai.vx = activeSpeed;
        } else {
          ai.vx *= aiGrounded ? 0.8 : 0.95;
        }
      } else {
        // 공이 AI 진영에 있거나, 유저 진영에서 멈춰있거나, AI가 이미 침투해 공격 중일 때 돌진 추적
        const distToBallX = targetX - ai.x;
        const isBallAboveHead = Math.abs(ball.x - ai.x) < 45 && ball.y < ai.y;
        
        if (isBallAboveHead) {
          // 공이 머리 위에 바로 있을 때는 비켜서기 위해 데드존을 25px로 넓히고 감속 대기
          if (distToBallX < -25) {
            ai.vx = -activeSpeed;
          } else if (distToBallX > 25) {
            ai.vx = activeSpeed;
          } else {
            ai.vx *= aiGrounded ? 0.8 : 0.95;
          }
        } else {
          // 위험 구역에서는 데드존을 최소화(3px)하여 바짝 쫓고, 그 외의 경우 인간적인 오차가 반영된 데드존(10px) 추적
          const currentDeadzone = isDangerZone ? 3 : 10;
          if (distToBallX < -currentDeadzone) {
            ai.vx = -activeSpeed;
          } else if (distToBallX > currentDeadzone) {
            ai.vx = activeSpeed;
          } else {
            ai.vx = 0;
          }
        }
      }

      // 공이 근처에 있고, 공의 높이가 머리 위 범위에 있고, AI가 바닥에 있을 때 무작위 점프
      const jumpDistX = ball.x - ai.x;
      if (Math.abs(jumpDistX) < 70 && ball.y < ai.y && ball.y > ai.y - 130 && aiGrounded) {
        // 머리 위에 바로 있는 끼임 우려 상황에서는 점프 확률을 35%로 상향
        const jumpChance = Math.abs(jumpDistX) < 45 ? 0.35 : 0.12;
        if (Math.random() < jumpChance) {
          ai.vy = ai.jumpForce;
        }
      }

      // 공중 슛 예측 점프 블로킹 (Shot Blocking)
      if (ball.x > 650 && ball.vx > 0 && aiGrounded) {
        const timeToGoal = (950 - ball.x) / ball.vx;
        if (timeToGoal > 0 && timeToGoal < 45) {
          const predictedY = ball.y + ball.vy * timeToGoal + 0.5 * (gravity * 0.75) * timeToGoal * timeToGoal;
          // 골문 상단 궤적 (Y: 190 ~ 310 사이)으로 들어갈 것으로 예측되고, 현재 공이 AI 머리 근처 높이 이상일 때
          if (predictedY >= 190 && predictedY <= 310 && ball.y < ai.y - 20) {
            ai.vy = ai.jumpForce;
          }
        }
      }

      // AI 중력 및 좌표 적용
      ai.vy += gravity;

      // 충돌 시 AI 순간 경직(Stun)
      if (aiStunTimer > 0) {
        aiStunTimer--;
        ai.vx = 0;
      }

      ai.x += ai.vx;
      ai.y += ai.vy;

      // --- 선수간 몸싸움 충돌 물리 (원형 충돌 판정 및 위치/속도 보정) ---
      const distPlayers = Math.hypot(ai.x - user.x, ai.y - user.y);
      const minPlayerDist = user.radius + ai.radius;
      if (distPlayers < minPlayerDist) {
        const angle = Math.atan2(ai.y - user.y, ai.x - user.x);
        const overlap = minPlayerDist - distPlayers;
        
        // 위치 보정 (플레이어 1은 왼쪽으로, 플레이어 2는 오른쪽으로 절반씩 밀어냄)
        user.x -= Math.cos(angle) * overlap * 0.5;
        user.y -= Math.sin(angle) * overlap * 0.5;
        ai.x += Math.cos(angle) * overlap * 0.5;
        ai.y += Math.sin(angle) * overlap * 0.5;

        // 속도 교환 및 밀려남 (물리 반발력 작용)
        const tempUserVx = user.vx;
        user.vx = ai.vx * 0.6 - user.vx * 0.4;
        ai.vx = tempUserVx * 0.6 - ai.vx * 0.4;
      }

      // AI 머리 드리블 감지 및 강제 점프 제한 (0.3초/18프레임 초과 시 헤더 점프)
      const isRestingOnAiHead = Math.abs(ball.x - ai.x) < 30 && ball.y < ai.y && ball.y >= ai.y - (ai.radius + ball.radius + 15);
      if (isRestingOnAiHead) {
        aiBallOnHeadTimer++;
        if (aiBallOnHeadTimer >= 18) {
          ai.vy = ai.jumpForce;
          aiBallOnHeadTimer = 0;
        }
      } else {
        aiBallOnHeadTimer = 0;
      }

      // 유저 경계 제한 (골망 안쪽 진입 방지 및 상대 진영 침범 허용)
      if (user.x < user.radius + 50) user.x = user.radius + 50;
      if (user.x > 950 - user.radius) user.x = 950 - user.radius;
      if (user.y > ground - user.radius) {
        user.y = ground - user.radius;
        user.vy = 0;
      }

      // AI 경계 제한 (상대 진영 침범 허용)
      if (ai.x < ai.radius + 50) ai.x = ai.radius + 50;
      if (ai.x > 950 - ai.radius) ai.x = 950 - ai.radius;
      if (ai.y > ground - ai.radius) {
        ai.y = ground - ai.radius;
        ai.vy = 0;
      }

      // --- 3. 공 물리 및 마찰력 ---
      ball.vy += gravity * 0.75; // 공은 약간 가벼운 느낌을 주기 위해 중력 소폭 감쇠
      ball.vx *= 0.98; // 가로 방향 마찰력을 기존 0.988 -> 0.98로 높여 속도를 부드럽고 자연스럽게 감속
      ball.vy *= 0.988;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // 공 바닥 튕김
      if (ball.y >= ground - ball.radius) {
        ball.y = ground - ball.radius;
        ball.vy = -ball.vy * bounce;
        ball.vx *= 0.95; // 굴러갈 때 마찰 소폭 증가
        if (Math.abs(ball.vy) > 0.3) {
          playBounceSound('wall');
        }
      }
      // 공 천장 튕김
      if (ball.y <= ball.radius) {
        ball.y = ball.radius;
        ball.vy = -ball.vy * bounce;
        playBounceSound('wall');
      }
      // 공 측면 벽 튕김 (골대 상단 공중)
      if (ball.y < 190) {
        if (ball.x <= ball.radius) {
          ball.x = ball.radius;
          ball.vx = -ball.vx * bounce;
          playBounceSound('wall');
        }
        if (ball.x >= 1000 - ball.radius) { // 기존 800 -> 1000
          ball.x = 1000 - ball.radius;
          ball.vx = -ball.vx * bounce;
          playBounceSound('wall');
        }
      } else {
        // 골대 밑 바닥 근처 뒷그물 튕김 (가로 1000px 기준 조정)
        if (ball.x < 5) {
          ball.x = 5;
          ball.vx = -ball.vx * 0.35; // 그물은 푹신하게 반발력 최소화
          playBounceSound('wall');
        }
        if (ball.x > 995) { // 기존 795 -> 995
          ball.x = 995;
          ball.vx = -ball.vx * 0.35;
          playBounceSound('wall');
        }
      }

      // --- 골대 크로스바/지붕 물리 충돌 (Y=190) ---
      // 왼쪽 골대 위 지붕 (X: 0 ~ 50, Y: 190)
      if (ball.x >= 0 && ball.x <= 50) {
        // 위에서 떨어지는 경우 튕겨냄
        if (ball.y + ball.radius >= 190 && ball.y - ball.radius < 190 && ball.vy > 0) {
          ball.y = 190 - ball.radius;
          ball.vy = -ball.vy * bounce;
          playBounceSound('wall');
        }
        // 아래에서 위로 솟구치는 경우 튕겨냄 (지붕 천장)
        else if (ball.y - ball.radius <= 190 && ball.y + ball.radius > 190 && ball.vy < 0) {
          ball.y = 190 + ball.radius;
          ball.vy = -ball.vy * bounce;
          playBounceSound('wall');
        }
      }

      // 오른쪽 골대 위 지붕 (X: 950 ~ 1000, Y: 190)
      if (ball.x >= 950 && ball.x <= 1000) {
        // 위에서 떨어지는 경우 튕겨냄
        if (ball.y + ball.radius >= 190 && ball.y - ball.radius < 190 && ball.vy > 0) {
          ball.y = 190 - ball.radius;
          ball.vy = -ball.vy * bounce;
          playBounceSound('wall');
        }
        // 아래에서 위로 솟구치는 경우 튕겨냄 (지붕 천장)
        else if (ball.y - ball.radius <= 190 && ball.y + ball.radius > 190 && ball.vy < 0) {
          ball.y = 190 + ball.radius;
          ball.vy = -ball.vy * bounce;
          playBounceSound('wall');
        }
      }

      // --- 4. 골대 포스트(모서리 크로스바) 충돌 처리 ---
      // 왼쪽 골포스트 (X=50, Y=190)
      const distLeftPost = Math.hypot(ball.x - 50, ball.y - 190);
      if (distLeftPost < ball.radius + 4) {
        const angle = Math.atan2(ball.y - 190, ball.x - 50);
        ball.vx = Math.cos(angle) * 7.5;
        ball.vy = Math.sin(angle) * 7.5;
        ball.x = 50 + Math.cos(angle) * (ball.radius + 5);
        ball.y = 190 + Math.sin(angle) * (ball.radius + 5);
        playBounceSound('wall');
      }
      // 오른쪽 골포스트 (X=950, Y=190)
      const distRightPost = Math.hypot(ball.x - 950, ball.y - 190);
      if (distRightPost < ball.radius + 4) {
        const angle = Math.atan2(ball.y - 190, ball.x - 950);
        ball.vx = Math.cos(angle) * 7.5;
        ball.vy = Math.sin(angle) * 7.5;
        ball.x = 950 + Math.cos(angle) * (ball.radius + 5);
        ball.y = 190 + Math.sin(angle) * (ball.radius + 5);
        playBounceSound('wall');
      }

      // --- 5. 플레이어 & 공 충돌 물리 ---
      // 유저 <-> 공
      const distUser = Math.hypot(ball.x - user.x, ball.y - user.y);
      if (distUser < user.radius + ball.radius) {
        let dx = ball.x - user.x;
        let dy = ball.y - user.y;
        
        // 머리 위 무한 끼임 방지: X축 거리가 너무 가까우면 강제로 수평 튕김 유도 (최소 16px 확보)
        if (Math.abs(dx) < 16) {
          dx = dx >= 0 ? 16 : -16;
        }
        
        const angle = Math.atan2(dy, dx);
        const overlap = (user.radius + ball.radius) - distUser;
        // 겹침 해제
        ball.x += Math.cos(angle) * overlap;
        ball.y += Math.sin(angle) * overlap;

        // 슈팅 스탯 보너스 반영 공식: 기존 11~12에서 7~8 수준으로 하향 조정 (p1ShootPower)
        const p1ShootPower = 3.0 + (user.stat_shoot * 0.05);
        ball.vx = Math.cos(angle) * p1ShootPower + user.vx * 0.45;

        // 강력한 수평 탄성 주입: 머리 위쪽 충돌 시 강제 미끄러짐 튕김
        if (dy < 0) {
          const pushDir = dx >= 0 ? 1 : -1;
          const minPush = Math.abs(ball.vx) + 5;
          ball.vx = pushDir * Math.max(Math.abs(ball.vx), minPush);
        }

        ball.vy = Math.sin(angle) * p1ShootPower + user.vy * 0.4 - 6.0; // 강력한 수직 상승 보너스 힘(-6) 추가
        playBounceSound('player');
      }

      // AI <-> 공
      const distAi = Math.hypot(ball.x - ai.x, ball.y - ai.y);
      if (distAi < ai.radius + ball.radius) {
        let dx = ball.x - ai.x;
        let dy = ball.y - ai.y;
        
        // 머리 위 무한 끼임 방지: X축 거리가 너무 가까우면 강제로 수평 튕김 유도 (최소 16px 확보)
        if (Math.abs(dx) < 16) {
          dx = dx >= 0 ? 16 : -16;
        }

        const angle = Math.atan2(dy, dx);
        const overlap = (ai.radius + ball.radius) - distAi;
        ball.x += Math.cos(angle) * overlap;
        ball.y += Math.sin(angle) * overlap;

        // 슈팅 스탯 보너스 반영 공식: 기존 11~12에서 7~8 수준으로 하향 조정 (p2ShootPower)
        const p2ShootPower = 3.0 + (ai.stat_shoot * 0.05);
        ball.vx = Math.cos(angle) * p2ShootPower + ai.vx * 0.45;

        // 강력한 수평 탄성 주입: 머리 위쪽 충돌 시 강제 미끄러짐 튕김
        if (dy < 0) {
          const pushDir = dx >= 0 ? 1 : -1;
          const minPush = Math.abs(ball.vx) + 5;
          ball.vx = pushDir * Math.max(Math.abs(ball.vx), minPush);
        }

        ball.vy = Math.sin(angle) * p2ShootPower + ai.vy * 0.4 - 6.0; // 강력한 수직 상승 보너스 힘(-6) 추가

        // 충돌 시 AI 순간 경직(Stun) 추가: 10프레임 동안 X축 이동 및 추적 일시 정지
        aiStunTimer = 10;
        playBounceSound('player');
      }

      // --- 6. 골 판정 ---
      if (ball.y > 190) {
        // 왼쪽 골대 득점 (AI 점수): 공이 크로스바 아래에 있고, 골대 안으로 완전히 들어갔을 때 (ball.x + ball.radius < 50)
        if (ball.x + ball.radius < 50) {
          aiScoreLocal++;
          setAiScore(aiScoreLocal);
          playFireworkSound();
          if (aiScoreLocal >= 5) {
            setWinner("AI");
            setGameState("GAMEOVER");
          } else {
            goalText = `${aiPlayer ? aiPlayer.nation : "AI"} GOAL!`;
            goalTimer = 90;
          }
        }
        // 오른쪽 골대 득점 (유저 점수): 공이 크로스바 아래에 있고, 골대 안으로 완전히 들어갔을 때 (ball.x - ball.radius > 950)
        else if (ball.x - ball.radius > 950) {
          userScoreLocal++;
          setMyScore(userScoreLocal);
          playFireworkSound();
          if (userScoreLocal >= 5) {
            setWinner("USER");
            setGameState("GAMEOVER");
          } else {
            goalText = `${myPlayer ? myPlayer.nation : "YOU"} GOAL!`;
            goalTimer = 90; // 약 1.5초
          }
        }
      }
    };

    // 렌더링 함수
    const drawGame = () => {
      ctx.clearRect(0, 0, 1000, 450);

      // 1. 하늘 배경 그라데이션
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 450);
      bgGrad.addColorStop(0, "#090d16");
      bgGrad.addColorStop(1, "#1e1e38");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 450);

      // 경기장 뒷배경 패턴 (스태디움 유도라인)
      ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(500, 400, 250, Math.PI, 0);
      ctx.stroke();

      // 중앙 하프라인 및 중앙 서클
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(500, 0);
      ctx.lineTo(500, 400);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(500, 400, 80, 0, Math.PI * 2);
      ctx.stroke();

      // 2. 그물망 렌더링
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(0, 190, 50, 210);
      ctx.fillRect(950, 190, 50, 210);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      // 왼쪽 그물 그물망선
      for (let yOffset = 190; yOffset <= 400; yOffset += 15) {
        ctx.beginPath();
        ctx.moveTo(0, yOffset);
        ctx.lineTo(50, yOffset);
        ctx.stroke();
      }
      for (let xOffset = 0; xOffset <= 50; xOffset += 10) {
        ctx.beginPath();
        ctx.moveTo(xOffset, 190);
        ctx.lineTo(xOffset, 400);
        ctx.stroke();
      }
      // 오른쪽 그물 그물망선
      for (let yOffset = 190; yOffset <= 400; yOffset += 15) {
        ctx.beginPath();
        ctx.moveTo(950, yOffset);
        ctx.lineTo(1000, yOffset);
        ctx.stroke();
      }
      for (let xOffset = 950; xOffset <= 1000; xOffset += 10) {
        ctx.beginPath();
        ctx.moveTo(xOffset, 190);
        ctx.lineTo(xOffset, 400);
        ctx.stroke();
      }

      // 3. 골 포스트 (흰색 빔)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      // 왼쪽 골대 프레임
      ctx.beginPath();
      ctx.moveTo(0, 190);
      ctx.lineTo(50, 190);
      ctx.lineTo(50, 400);
      ctx.stroke();
      // 오른쪽 골대 프레임
      ctx.beginPath();
      ctx.moveTo(1000, 190);
      ctx.lineTo(950, 190);
      ctx.lineTo(950, 400);
      ctx.stroke();

      // 4. 잔디 바닥 렌더링
      ctx.fillStyle = "#166534"; // 잔디 진한 색
      ctx.fillRect(0, 400, 1000, 50);
      ctx.fillStyle = "#15803d"; // 잔디 연한 색 줄무늬
      for (let stripe = 0; stripe < 1000; stripe += 100) {
        if ((stripe / 100) % 2 === 0) {
          ctx.fillRect(stripe, 400, 50, 50);
        }
      }
      // 잔디 경계 엣지 라인
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(0, 400, 1000, 4);

      // 5. 대두(Player) 캐릭터 렌더링
      // 유저 대두 전사 (Blue)
      drawBighead(ctx, user.x, user.y, user.radius, "#3b82f6", "#1d4ed8", true, user.name);
      // AI 대두 전사 (Red)
      drawBighead(ctx, ai.x, ai.y, ai.radius, "#ef4444", "#b91c1c", false, ai.name);

      // 6. 공(Ball) 렌더링
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 축구공 5각 무늬 패턴 연출
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / 5) {
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + Math.cos(angle) * ball.radius, ball.y + Math.sin(angle) * ball.radius);
        ctx.stroke();
      }
      ctx.restore();

      // 7. 골 득점 텍스트 연출
      if (goalText) {
        // 어두운 레이어 오버레이
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(0, 140, 1000, 130);

        // 골 연출 폰트 크기 계산 (맥박/확대 효과)
        const progress = (90 - goalTimer) / 90; // 0 ~ 1
        const scale = progress < 0.2 
          ? 1.0 + (0.2 - progress) * 2.5 // 처음 20% 동안은 엄청 큰 크기(최대 1.5배)로 깜짝 시작
          : 1.0 + Math.sin(goalTimer * 0.15) * 0.08; // 이후에는 약한 맥박(Pulsing) 효과
          
        const fontSize = Math.floor(75 * scale);

        // 황금색/오렌지색 그라데이션 필
        const grad = ctx.createLinearGradient(0, 150, 0, 240);
        grad.addColorStop(0, "#fbbf24"); // 밝은 황금색
        grad.addColorStop(0.5, "#f59e0b"); // 호박색
        grad.addColorStop(1, "#ea580c"); // 오렌지색
        
        ctx.fillStyle = grad;
        ctx.font = `bold italic ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // 텍스트 외곽선 추가로 입체감 부여
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeText(goalText, 500, 205);
        ctx.fillText(goalText, 500, 205);
      }

      // 8. 일시정지 오버레이
      if (isPausedRef.current) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, 0, 1000, 450);

        ctx.save();
        ctx.shadowColor = "#00f5d4";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#00f5d4";
        ctx.font = "bold italic 54px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAME PAUSED", 500, 200);
        ctx.restore();

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Press ESC or Click Pause Button to Resume", 500, 260);
      }
    };

    // 캐릭터 그리기 디테일 헬퍼 함수
    function drawBighead(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      lightColor: string,
      darkColor: string,
      isPlayerSide: boolean,
      nameTag: string
    ) {
      c.save();

      // 그림자
      c.beginPath();
      c.ellipse(x, y + r - 3, r * 0.85, 7, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(0, 0, 0, 0.35)";
      c.fill();

      // 얼굴(머리) 몸통 원형 그라데이션
      const grad = c.createRadialGradient(x - r / 3.5, y - r / 3.5, r * 0.1, x, y, r);
      grad.addColorStop(0, lightColor);
      grad.addColorStop(1, darkColor);

      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = grad;
      c.fill();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2.5;
      c.stroke();

      // 이목구비 그리기 (방향 설정)
      const dir = isPlayerSide ? 1 : -1;
      const eyeX = x + r * 0.45 * dir;
      const eyeY = y - r * 0.12;
      const eyeRadius = r * 0.22;

      // 흰자
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#000000";
      c.lineWidth = 1.5;
      c.stroke();

      // 눈동자 (공 방향 응시)
      c.fillStyle = "#000000";
      c.beginPath();
      c.arc(eyeX + r * 0.07 * dir, eyeY, eyeRadius * 0.52, 0, Math.PI * 2);
      c.fill();

      // 표정 (입 모양)
      c.strokeStyle = "#ffffff";
      c.lineWidth = 3;
      c.lineCap = "round";
      c.beginPath();
      if (isPlayerSide) {
        c.arc(x + r * 0.28, y + r * 0.3, r * 0.3, 0, Math.PI * 0.6);
      } else {
        c.arc(x - r * 0.28, y + r * 0.3, r * 0.3, Math.PI * 0.4, Math.PI);
      }
      c.stroke();

      // 미니 축구 신발 (대두 하단 배치)
      const shoeX = x - r * 0.2 * dir;
      const shoeY = y + r + 4;
      c.fillStyle = "#facc15"; // 밝은 노랑 축구화
      c.beginPath();
      c.ellipse(shoeX, shoeY, r * 0.4, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.5;
      c.stroke();

      // 선수명 라벨 렌더링
      c.fillStyle = "rgba(15, 23, 42, 0.85)";
      c.fillRect(x - 45, y - r - 28, 90, 18);
      c.strokeStyle = "rgba(255, 255, 255, 0.2)";
      c.lineWidth = 1;
      c.strokeRect(x - 45, y - r - 28, 90, 18);

      c.fillStyle = "#ffffff";
      c.font = "bold 10px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(nameTag, x, y - r - 18);

      c.restore();
    }

    // 게임 루프
    const gameLoop = () => {
      updateGame();
      drawGame();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [gameState, myPlayer, aiPlayer]);

  return (
    <main 
      className="min-h-screen text-slate-100 flex flex-col justify-between relative overflow-hidden"
      style={{ 
        backgroundImage: "url('/game_bg.jpg')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        backgroundAttachment: 'fixed' 
      }}
    >
      {/* 배경 이미지를 어둡고 은은하게 깔아주어 글씨 가독성을 높이는 오버레이 */}
      <div className="absolute inset-0 bg-slate-950/80 z-0 pointer-events-none"></div>

      {/* 상단 네비게이션 헤더 */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            메인화면으로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-red-500">LIVE MATCH ARENA</span>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-7xl mx-auto w-full relative z-10">
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <p className="font-medium text-sm">경기장 입장 및 라인업 로딩 중...</p>
          </div>
        ) : (
          <>
            {gameState === "SELECT" && (
              <div className="w-full flex flex-col items-center">
                {/* 타이틀 및 설명 */}
                <div className="text-center mb-10">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold tracking-widest uppercase mb-3 inline-block">
                    Match Settings
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight mt-1 text-white">
                    대두축구 라인업 구성
                  </h1>
                  <p className="text-slate-400 text-sm md:text-base mt-2 max-w-xl">
                    나의 대두 전사와 맞대결을 펼칠 AI 상대 선수를 선택하세요. 능력치 격차를 분석하고 전략적인 게임을 즐기세요!
                  </p>
                </div>

                {/* 대결 설정 레이아웃 (VS) */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-7 gap-8 items-center mb-12">
                  
                  {/* 플레이어 카드 (L) */}
                  <div className="lg:col-span-3 flex flex-col items-center bg-slate-950/60 backdrop-blur-md border-2 border-cyan-500/40 rounded-3xl p-6 shadow-[0_0_25px_rgba(6,182,212,0.15)] relative overflow-hidden group hover:border-cyan-400 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#00f5d4] to-cyan-500"></div>
                    <span className="absolute top-4 left-4 text-xs font-bold bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      PLAYER (YOU)
                    </span>

                    {/* 플레이어 셀렉트 박스 */}
                    <div className="w-full mt-6 mb-6 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">국가 선택</label>
                        <select
                          value={p1SelectedNation}
                          onChange={(e) => handleP1NationChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                          {nations.map((nation) => (
                            <option key={nation} value={nation}>
                              {nation}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">내 선수 선택</label>
                        <select
                          value={myPlayerId || ""}
                          onChange={(e) => setMyPlayerId(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                          {players
                            .filter((p) => p1SelectedNation === "전체" || p.nation === p1SelectedNation)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.position}] {p.name} ({p.nation})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* 플레이어 상세 카드 시각화 */}
                    {myPlayer && <PlayerCardDetail player={myPlayer} type="blue" />}
                  </div>

                  {/* VS 아이콘 영역 (M) */}
                  <div className="lg:col-span-1 flex flex-col items-center justify-center py-6">
                    <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(147,51,234,0.5)] border-4 border-slate-950 relative z-10 animate-pulse">
                      <Swords className="w-8 h-8 text-white" />
                    </div>
                    <div className="hidden lg:block w-0.5 h-48 bg-gradient-to-b from-transparent via-slate-800 to-transparent -mt-8"></div>
                  </div>

                  {/* AI 카드 (R) */}
                  <div className="lg:col-span-3 flex flex-col items-center bg-slate-950/60 backdrop-blur-md border-2 border-pink-500/40 rounded-3xl p-6 shadow-[0_0_25px_rgba(236,72,153,0.15)] relative overflow-hidden group hover:border-pink-400 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 to-[#ea580c]"></div>
                    <span className="absolute top-4 left-4 text-xs font-bold bg-pink-500/10 text-pink-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      OPPONENT (AI)
                    </span>

                    {/* AI 셀렉트 박스 */}
                    <div className="w-full mt-6 mb-6 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">국가 선택</label>
                        <select
                          value={p2SelectedNation}
                          onChange={(e) => handleP2NationChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-pink-500 transition-colors"
                        >
                          {nations.map((nation) => (
                            <option key={nation} value={nation}>
                              {nation}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">상대 AI 선택</label>
                        <select
                          value={aiPlayerId || ""}
                          onChange={(e) => setAiPlayerId(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-pink-500 transition-colors"
                        >
                          {players
                            .filter((p) => p2SelectedNation === "전체" || p.nation === p2SelectedNation)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.position}] {p.name} ({p.nation})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* AI 상세 카드 시각화 */}
                    {aiPlayer && <PlayerCardDetail player={aiPlayer} type="red" />}
                  </div>

                </div>

                {/* 경기 시작 버튼 */}
                <button
                  onClick={handleStartGame}
                  className="flex items-center gap-2 px-12 py-4.5 bg-gradient-to-r from-[#22c55e] to-[#00f5d4] hover:from-[#4ade80] hover:to-[#22d3ee] text-black text-xl font-extrabold tracking-widest rounded-xl shadow-[0_0_25px_rgba(34,197,94,0.3)] transition-all duration-300 transform -skew-x-12 hover:-skew-x-12 hover:scale-105 active:scale-95 hover:shadow-[0_0_35px_rgba(34,197,94,0.6)] cursor-pointer uppercase"
                >
                  <Play className="w-5 h-5 fill-black transform skew-x-12" />
                  <span className="transform skew-x-12">경기 시작 (KICK OFF)</span>
                </button>
              </div>
            )}

            {gameState === "PLAYING" && (
              <div className="w-full max-w-5xl flex flex-col items-center">
                {/* 대결 스코어보드 헤더 */}
                <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 mb-8 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3 w-1/3">
                    <span className="text-xs font-extrabold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">USER</span>
                    <span className="text-base md:text-lg font-bold truncate max-w-[120px] md:max-w-none">{myPlayer?.name}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 w-1/3">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-black text-blue-400">{myScore}</span>
                      <span className="text-xl font-bold text-slate-600">:</span>
                      <span className="text-3xl font-black text-red-400">{aiScore}</span>
                    </div>
                    <button
                      onClick={togglePause}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg text-[10px] md:text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-3 h-3 text-[#00f5d4] fill-[#00f5d4]" />
                          <span>재개 (Resume)</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span>일시정지 (Pause)</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-3 w-1/3">
                    <span className="text-base md:text-lg font-bold text-right truncate max-w-[120px] md:max-w-none">{aiPlayer?.name}</span>
                    <span className="text-xs font-extrabold px-2 py-0.5 bg-red-500/20 text-red-400 rounded">AI</span>
                  </div>
                </div>

                {/* 게임 캔버스 */}
                <div className="w-full bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
                  <canvas
                    ref={canvasRef}
                    width={1000}
                    height={450}
                    className="w-full aspect-[20/9] block bg-slate-950"
                  />
                </div>

                {/* 조작 설명 및 뒤로가기 제어 */}
                <div className="mt-8 flex flex-col md:flex-row items-center justify-between w-full max-w-4xl gap-4">
                  <div className="flex flex-wrap gap-2 md:gap-4 text-xs font-mono text-slate-500 bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-800/80">
                    <span className="font-semibold text-slate-400">조작법:</span>
                    <span>방향키 ← / → (이동)</span>
                    <span>|</span>
                    <span>방향키 ↑ 또는 Space (점프)</span>
                    <span>|</span>
                    <span>ESC (일시정지)</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsPaused(false);
                      isPausedRef.current = false;
                      setGameState("SELECT");
                    }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  >
                    포기하고 라인업 재구성으로 나가기
                  </button>
                </div>
              </div>
            )}

            {gameState === "GAMEOVER" && (
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 animate-pulse"></div>
                
                <div className="w-20 h-20 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-10 h-10 animate-bounce" />
                </div>

                <h1 className="text-3xl font-black mb-2">경기 종료!</h1>
                <p className="text-slate-400 text-sm mb-6">최종 스코어 {myScore} : {aiScore}</p>

                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 mb-8">
                  {winner === "USER" ? (
                    <div>
                      <span className="text-xs font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full uppercase tracking-wider">WINNER</span>
                      <h2 className="text-2xl font-bold mt-3 text-white">{myPlayer?.nation} 승리! 🎉</h2>
                      <p className="text-slate-400 text-xs mt-1">{myPlayer?.name}</p>
                    </div>
                  ) : (
                    <div>
                  <span className="text-xs font-black text-red-400 bg-red-500/10 px-3 py-1 rounded-full uppercase tracking-wider">WINNER</span>
                      <h2 className="text-2xl font-bold mt-3 text-white">{aiPlayer?.nation} 승리! 🤖</h2>
                      <p className="text-slate-400 text-xs mt-1">{aiPlayer?.name}</p>
                    </div>
                  )}
                </div>

                {/* 연승 정보 표시 */}
                {playerStreakInfo !== null && typeof window !== "undefined" && localStorage.getItem("worldcup_player_name") !== "게스트" && (
                  <div className="mb-6 p-4 bg-slate-950/80 border border-[#00f5d4]/20 rounded-2xl flex items-center justify-around">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">현재 연승</span>
                      <p className="text-lg font-black text-rose-400 flex items-center gap-1 justify-center">
                        <Flame className="w-4 h-4 fill-rose-500/20 text-rose-500" /> {playerStreakInfo.current} 연승
                      </p>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10"></div>
                    <div className="text-center">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">최대 연승</span>
                      <p className="text-lg font-black text-[#7bf119] flex items-center gap-1 justify-center">
                        <Trophy className="w-4 h-4 text-[#7bf119]" /> {playerStreakInfo.max} 연승
                      </p>
                    </div>
                  </div>
                )}

                {/* 게스트 안내 문구 */}
                {typeof window !== "undefined" && localStorage.getItem("worldcup_player_name") === "게스트" && (
                  <div className="mb-6 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400">
                    💡 게스트 모드로 플레이 중이므로 연승 기록이 리더보드에 저장되지 않습니다.
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleStartGame}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    재경기 시작 (Rematch)
                  </button>
                  <button
                    onClick={() => setGameState("SELECT")}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    선수 다시 선택하기
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 푸터 */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500 relative z-10">
        <p>© 2026 Big Head Football Match Engine. Powered by Gemini Next.js.</p>
      </footer>
    </main>
  );
}

// 플레이어 상세 카드 컴포넌트
function PlayerCardDetail({ player, type }: { player: Player; type: "blue" | "red" }) {
  const barColor = type === "blue" ? "bg-blue-500" : "bg-red-500";
  const posColor = player.position === 'FW' ? 'bg-red-500/20 text-red-400' :
                   player.position === 'MF' ? 'bg-green-500/20 text-green-400' :
                   'bg-blue-500/20 text-blue-400';

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-800/80 mb-5">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700/60 shadow-inner overflow-hidden">
          <img
            src={`https://flagcdn.com/w160/${nationCodes[player.nation] || 'un'}.png`}
            alt={`${player.nation} 국기`}
            className="w-12 h-12 rounded-full object-cover border border-slate-700"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-xl text-white tracking-wide">{player.name}</h3>
            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${posColor}`}>
              {player.position}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">{player.nation}</p>
        </div>
      </div>

      {/* 비교 능력치 게이지 */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#facc15]" /> 속도 (SPEED)</span>
            <span className="text-slate-100 font-extrabold">{player.stat_speed}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-750">
            <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${player.stat_speed}%` }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5 text-[#ec4899]" /> 슈팅 (SHOOT)</span>
            <span className="text-slate-100 font-extrabold">{player.stat_shoot}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-750">
            <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${player.stat_shoot}%` }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><ChevronsUp className="w-3.5 h-3.5 text-[#22c55e]" /> 점프 (JUMP)</span>
            <span className="text-slate-100 font-extrabold">{player.stat_jump}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-750">
            <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${player.stat_jump}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

let audioCtx: AudioContext | null = null;

function playBounceSound(type: 'player' | 'wall') {
  if (typeof window === 'undefined') return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'player') {
      // 선수 헤더/몸싸움: 팍! 소리 (170Hz -> 40Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
      
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
      
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      // 벽/바닥/크로스바: 쿵/툭 소리 (120Hz -> 30Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
      
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {
    console.warn("오디오 재생 실패:", e);
  }
}

function playFireworkSound() {
  if (typeof window === 'undefined') return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    // 1. 저음의 쾅 폭발음 (sine wave, 80Hz -> 10Hz)
    const boomOsc = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    
    boomOsc.connect(boomGain);
    boomGain.connect(audioCtx.destination);
    
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(80, now);
    boomOsc.frequency.exponentialRampToValueAtTime(10, now + 0.8);
    
    boomGain.gain.setValueAtTime(0.6, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    boomOsc.start(now);
    boomOsc.stop(now + 0.8);
    
    // 2. 고음의 "타다닥" 불꽃 크랙클 노이즈
    const bufferSize = audioCtx.sampleRate * 0.5; // 0.5초 분량
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const rand = Math.random() * 2 - 1;
      // 강한 불꽃 크랙클 소리 생성
      data[i] = Math.random() < 0.04 ? rand * 0.5 : rand * 0.04;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.Q.setValueAtTime(3.5, now);
    
    const noiseGain = audioCtx.createGain();
    
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.linearRampToValueAtTime(0.2, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.5);
  } catch (e) {
    console.warn("폭죽 사운드 재생 실패:", e);
  }
}

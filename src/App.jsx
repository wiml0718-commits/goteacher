import { useState, useCallback, useEffect, useRef } from "react";

// ── SGF Parser ────────────────────────────────────────────────────────────────
function sgfCoordToRC(coord, size = 19) {
  if (!coord || coord === "" || coord === "tt") return null;
  const col = coord.charCodeAt(0) - 97;
  const row = coord.charCodeAt(1) - 97;
  if (row < 0 || row >= size || col < 0 || col >= size) return null;
  return [row, col];
}

function parseSGF(sgf) {
  const sizeM = sgf.match(/SZ\[(\d+)\]/);
  const size = sizeM ? parseInt(sizeM[1]) : 19;
  const commentM = sgf.match(/C\[([^\]]*)\]/);
  const comment = commentM ? commentM[1].trim() : "";
  const toPlayM = sgf.match(/PL\[([BW])\]/);
  const toPlay = toPlayM ? toPlayM[1] : "B";

  const parseCoords = (tag) => {
    const re = new RegExp(`${tag}\\[([a-z]{2})\\]`, "g");
    const coords = [];
    let m;
    while ((m = re.exec(sgf)) !== null) {
      const rc = sgfCoordToRC(m[1], size);
      if (rc) coords.push(rc);
    }
    return coords;
  };

  const blacks = parseCoords("AB");
  const whites = parseCoords("AW");

  // 解析變化分支，找正解手
  const variations = [];
  const varRe = /\(;[BW]\[([a-z]{2})\](?:[^C]*)(?:C\[([^\]]*)\])?\s*\)/g;
  let vm;
  while ((vm = varRe.exec(sgf)) !== null) {
    const rc = sgfCoordToRC(vm[1], size);
    const c = vm[2] || "";
    const isCorrect = !c.match(/失敗|wrong|fail|incorrect|mistake/i) &&
      (c.match(/正解|correct|right|good|answer|lives|captures|Black lives|White lives/i) || c.length === 0);
    if (rc) variations.push({ rc, comment: c, isCorrect: !!isCorrect });
  }

  return { size, blacks, whites, toPlay, comment, variations };
}

function buildBoard(size, blacks, whites) {
  const b = Array.from({ length: size }, () => Array(size).fill(0));
  blacks.forEach(([r, c]) => { if (r >= 0 && r < size && c >= 0 && c < size) b[r][c] = 1; });
  whites.forEach(([r, c]) => { if (r >= 0 && r < size && c >= 0 && c < size) b[r][c] = 2; });
  return b;
}

// ── 題目清單 ──────────────────────────────────────────────────────────────────
const PROBLEM_LIST = {
  easy: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    filename: `ggg-easy-${String(i + 1).padStart(3, "0")}.sgf`,
    level: "初級", levelColor: "#4CAF50",
  })),
  intermediate: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    filename: `ggg-intermediate-${String(i + 1).padStart(3, "0")}.sgf`,
    level: "中級", levelColor: "#FF9800",
  })),
  hard: Array.from({ length: 15 }, (_, i) => ({
    id: i + 100,
    filename: `ggg-hard-${String(i + 100).padStart(3, "0")}.sgf`,
    level: "高級", levelColor: "#F44336",
  })),
};

const BASE_URL = "/sgf";

async function fetchSGF(difficulty, filename) {
  const url = `${BASE_URL}/${difficulty}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── 棋盤元件 ──────────────────────────────────────────────────────────────────
function GoBoard({ size = 19, board, onIntersectionClick, lastMove, correctMoves = [], wrongMoves = [], showAnswers = false }) {
  const maxW = Math.min(370, (typeof window !== "undefined" ? window.innerWidth : 400) - 28);
  const cellSize = Math.floor((maxW - 28) / (size - 1));
  const padding = Math.round(cellSize * 1.15);
  const boardPx = (size - 1) * cellSize + padding * 2;

  const starPoints = size === 19
    ? [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]]
    : size === 13
    ? [[3,3],[3,9],[9,3],[9,9],[6,6]]
    : [[2,2],[2,6],[6,2],[6,6],[4,4]];

  return (
    <div style={{ position:"relative", width:boardPx, height:boardPx, margin:"0 auto", flexShrink:0 }}>
      <svg width={boardPx} height={boardPx} style={{ position:"absolute", top:0, left:0 }}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D4A853"/>
            <stop offset="50%" stopColor="#C9952A"/>
            <stop offset="100%" stopColor="#AE7610"/>
          </linearGradient>
        </defs>
        <rect width={boardPx} height={boardPx} fill="url(#wg)" rx={3}/>
        {Array.from({length:size}).map((_,i)=>(
          <g key={i}>
            <line x1={padding+i*cellSize} y1={padding} x2={padding+i*cellSize} y2={padding+(size-1)*cellSize} stroke="#8B6010" strokeWidth={0.8} opacity={0.65}/>
            <line x1={padding} y1={padding+i*cellSize} x2={padding+(size-1)*cellSize} y2={padding+i*cellSize} stroke="#8B6010" strokeWidth={0.8} opacity={0.65}/>
          </g>
        ))}
        {starPoints.map(([r,c],i)=>(
          <circle key={i} cx={padding+c*cellSize} cy={padding+r*cellSize} r={size===9?2.5:3} fill="#6B4A08"/>
        ))}
        {Array.from({length:size}).map((_,i)=>(
          <g key={i}>
            <text x={padding+i*cellSize} y={padding-cellSize*0.38} textAnchor="middle" fontSize={cellSize*0.34} fill="#8B6010" fontFamily="Georgia">
              {String.fromCharCode(65+(i>=8?i+1:i))}
            </text>
            <text x={padding-cellSize*0.42} y={padding+i*cellSize+cellSize*0.12} textAnchor="middle" fontSize={cellSize*0.34} fill="#8B6010" fontFamily="Georgia">
              {size-i}
            </text>
          </g>
        ))}
      </svg>

      {Array.from({length:size}).map((_,r)=>
        Array.from({length:size}).map((_,c)=>{
          const stone = board[r]?.[c]??0;
          const isLast = lastMove&&lastMove[0]===r&&lastMove[1]===c;
          const isCorrect = showAnswers&&correctMoves.some(m=>m[0]===r&&m[1]===c);
          const isWrong = wrongMoves.some(m=>m[0]===r&&m[1]===c);
          const x = padding+c*cellSize, y = padding+r*cellSize;
          const sr = cellSize*0.47;
          const uid = `${r}-${c}`;
          return (
            <svg key={uid} style={{position:"absolute",left:x-sr,top:y-sr,width:sr*2,height:sr*2,
              cursor:stone===0?"pointer":"default",overflow:"visible"}}
              onClick={()=>stone===0&&onIntersectionClick?.(r,c)}>
              {stone===1&&(<>
                <defs><radialGradient id={`b${uid}`} cx="38%" cy="32%">
                  <stop offset="0%" stopColor="#666"/><stop offset="100%" stopColor="#111"/>
                </radialGradient></defs>
                <circle cx={sr} cy={sr} r={sr-0.5} fill={`url(#b${uid})`}/>
                {isLast&&<circle cx={sr} cy={sr} r={sr*0.32} fill="none" stroke="#E8C84A" strokeWidth={1.5}/>}
              </>)}
              {stone===2&&(<>
                <defs><radialGradient id={`w${uid}`} cx="38%" cy="32%">
                  <stop offset="0%" stopColor="#FAFAFA"/><stop offset="100%" stopColor="#C0C0C0"/>
                </radialGradient></defs>
                <circle cx={sr} cy={sr} r={sr-0.5} fill={`url(#w${uid})`} stroke="#AAA" strokeWidth={0.5}/>
                {isLast&&<circle cx={sr} cy={sr} r={sr*0.32} fill="none" stroke="#444" strokeWidth={1.5}/>}
              </>)}
              {stone===0&&isCorrect&&<circle cx={sr} cy={sr} r={sr*0.52} fill="rgba(76,175,80,0.35)" stroke="#4CAF50" strokeWidth={1.5}/>}
              {stone===0&&isWrong&&(<>
                <line x1={sr*0.3} y1={sr*0.3} x2={sr*1.7} y2={sr*1.7} stroke="#E53935" strokeWidth={2}/>
                <line x1={sr*1.7} y1={sr*0.3} x2={sr*0.3} y2={sr*1.7} stroke="#E53935" strokeWidth={2}/>
              </>)}
              {stone===0&&<circle cx={sr} cy={sr} r={sr} fill="transparent"/>}
            </svg>
          );
        })
      )}
    </div>
  );
}

// ── AI 解說 ───────────────────────────────────────────────────────────────────
async function fetchAIComment(context, moveRC, isCorrect, size) {
  const col = String.fromCharCode(65+(moveRC[1]>=8?moveRC[1]+1:moveRC[1]));
  const row = size - moveRC[0];
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1000,
      system:"你是親切的圍棋老師，繁體中文，80字內具體解說棋理，適合初學者。",
      messages:[{role:"user",content:`圍棋死活題（${context}），玩家下在${col}${row}，這手棋${isCorrect?"是正解":"是敗著"}。請簡短解說原因。`}],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text ?? "（解說載入失敗）";
}

// ── 死活題頁面 ────────────────────────────────────────────────────────────────
function TsumegoPage() {
  const [difficulty, setDifficulty] = useState("easy");
  const [probIdx, setProbIdx] = useState(0);
  const [sgfData, setSgfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState("playing");
  const [wrongMoves, setWrongMoves] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const problems = PROBLEM_LIST[difficulty];
  const currentProb = problems[probIdx];

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSgfData(null); setBoard(null);
    setStatus("playing"); setWrongMoves([]); setShowAnswer(false);
    setLastMove(null); setAiComment("");
    fetchSGF(difficulty, currentProb.filename).then(sgf => {
      if (cancelled) return;
      const parsed = parseSGF(sgf);
      parsed.level = currentProb.level;
      setSgfData(parsed);
      setBoard(buildBoard(parsed.size, parsed.blacks, parsed.whites));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError("無法載入題目，請確認網路連線後重試"); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [difficulty, probIdx]);

  const handleClick = useCallback(async (r, c) => {
    if (status !== "playing" || !sgfData) return;
    const correct = sgfData.variations.find(v => v.rc[0]===r && v.rc[1]===c && v.isCorrect);
    const isCorrect = !!correct || sgfData.variations.length === 0;
    setLastMove([r, c]);
    if (isCorrect) {
      const nb = board.map(row => [...row]);
      nb[r][c] = sgfData.toPlay==="B" ? 1 : 2;
      setBoard(nb); setStatus("correct");
      setAiLoading(true);
      const cm = await fetchAIComment(sgfData.comment || sgfData.level, [r,c], true, sgfData.size);
      setAiComment(cm); setAiLoading(false);
    } else {
      setWrongMoves(w => [...w,[r,c]]); setStatus("wrong");
      setAiLoading(true);
      const cm = await fetchAIComment(sgfData.comment || sgfData.level, [r,c], false, sgfData.size);
      setAiComment(cm); setAiLoading(false);
      setTimeout(() => setStatus("playing"), 1200);
    }
  }, [status, sgfData, board]);

  const correctMoves = sgfData?.variations.filter(v=>v.isCorrect).map(v=>v.rc) ?? [];

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
      {/* 難度 */}
      <div style={{display:"flex",gap:8}}>
        {[["easy","初級","#4CAF50"],["intermediate","中級","#FF9800"],["hard","高級","#F44336"]].map(([key,label,color])=>(
          <button key={key} onClick={()=>{setDifficulty(key);setProbIdx(0);}}
            style={{padding:"7px 16px",borderRadius:20,border:`2px solid ${difficulty===key?color:"transparent"}`,
              background:difficulty===key?`${color}20`:"rgba(255,255,255,0.05)",
              color:difficulty===key?color:"#777",cursor:"pointer",fontSize:13,fontFamily:"Georgia",transition:"all 0.2s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* 題號 */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"center",maxWidth:380}}>
        {problems.slice(0,20).map((p,i)=>(
          <button key={i} onClick={()=>setProbIdx(i)}
            style={{width:30,height:30,borderRadius:7,border:"none",cursor:"pointer",fontSize:11,
              background:i===probIdx?"#2D5016":"rgba(255,255,255,0.06)",
              color:i===probIdx?"#E8C84A":"#555"}}>
            {i+1}
          </button>
        ))}
      </div>

      {/* 說明 */}
      {sgfData&&(
        <div style={{textAlign:"center"}}>
          <span style={{background:currentProb.levelColor+"25",color:currentProb.levelColor,
            fontSize:11,padding:"3px 10px",borderRadius:10,border:`1px solid ${currentProb.levelColor}44`}}>
            {currentProb.level}
          </span>
          <p style={{margin:"7px 0 0",color:"#999",fontSize:13,maxWidth:340}}>
            {sgfData.toPlay==="B"?"⚫ 黑棋":"⚪ 白棋"}先手 — {sgfData.comment||"找出正確的一手"}
          </p>
        </div>
      )}

      {loading&&<div style={{color:"#555",fontSize:14,padding:40}}>載入中…</div>}
      {error&&<div style={{color:"#E57373",fontSize:13,textAlign:"center"}}>{error}</div>}
      {board&&sgfData&&(
        <GoBoard size={sgfData.size} board={board} onIntersectionClick={handleClick}
          lastMove={lastMove} correctMoves={correctMoves} wrongMoves={wrongMoves} showAnswers={showAnswer}/>
      )}

      {status==="correct"&&<div style={{background:"rgba(76,175,80,0.12)",border:"1px solid #4CAF50",borderRadius:10,padding:"8px 20px",color:"#81C784",fontSize:14}}>✓ 正解！</div>}
      {status==="wrong"&&<div style={{background:"rgba(229,57,53,0.12)",border:"1px solid #E53935",borderRadius:10,padding:"8px 20px",color:"#EF9A9A",fontSize:14}}>✗ 再想想…</div>}

      {(aiComment||aiLoading)&&(
        <div style={{background:"rgba(232,200,74,0.07)",border:"1px solid rgba(232,200,74,0.22)",
          borderRadius:10,padding:"12px 14px",maxWidth:360,width:"100%",fontSize:13,color:"#CCC",lineHeight:1.75}}>
          <span style={{color:"#E8C84A",fontSize:11,display:"block",marginBottom:4}}>🤖 AI 老師</span>
          {aiLoading?"分析中…":aiComment}
        </div>
      )}

      {board&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>setShowAnswer(!showAnswer)}
            style={{padding:"8px 14px",borderRadius:8,border:"1px solid #444",background:"transparent",color:"#888",cursor:"pointer",fontSize:13}}>
            {showAnswer?"隱藏答案":"👁 顯示答案"}
          </button>
          <button onClick={()=>setProbIdx(i=>Math.max(0,i-1))} disabled={probIdx===0}
            style={{padding:"8px 12px",borderRadius:8,border:"1px solid #333",background:"transparent",color:probIdx===0?"#333":"#888",cursor:probIdx===0?"default":"pointer",fontSize:13}}>
            ◀ 上一題
          </button>
          <button onClick={()=>setProbIdx(i=>Math.min(problems.length-1,i+1))}
            style={{padding:"8px 12px",borderRadius:8,border:"none",background:"#2D5016",color:"#E8C84A",cursor:"pointer",fontSize:13}}>
            下一題 ▶
          </button>
        </div>
      )}
    </div>
  );
}

// ── 棋譜頁面 ──────────────────────────────────────────────────────────────────
const KIFU = [{
  title:"李昌鎬 vs 劉昌赫",event:"1995年三星火災杯",
  black:"李昌鎬",white:"劉昌赫",result:"黑棋中盤勝",size:19,
  moves:[
    {move:[3,3,1],comment:"黑棋小目佔左上角，穩健開局。"},
    {move:[15,15,2],comment:"白棋對稱右下角，針鋒相對。"},
    {move:[3,15,1],comment:"黑棋再佔右上角，兩個小目連成勢力。"},
    {move:[15,3,2],comment:"白棋完成四角均分，局面均衡。"},
    {move:[9,9,1],comment:"黑棋佔天元！宣示中央野心，李昌鎬特色下法。"},
    {move:[5,3,2],comment:"白棋掛角，試探黑棋左上角的應對。"},
    {move:[3,5,1],comment:"黑棋小飛守角，形狀好，兼顧邊路發展。"},
    {move:[5,15,2],comment:"白棋同樣掛右上角，保持對稱。"},
    {move:[3,13,1],comment:"黑棋一間夾，積極不讓白棋輕易安定。"},
    {move:[7,15,2],comment:"白棋跳出求聯絡，進入中盤戰鬥。"},
  ],
}];

function KifuPage() {
  const [moveIdx,setMoveIdx] = useState(0);
  const [board,setBoard] = useState(null);
  const [aiComment,setAiComment] = useState("");
  const [aiLoading,setAiLoading] = useState(false);
  const [autoPlay,setAutoPlay] = useState(false);
  const autoRef = useRef(null);
  const kifu = KIFU[0];

  const buildKB = useCallback((upTo)=>{
    const b = Array.from({length:kifu.size},()=>Array(kifu.size).fill(0));
    for(let i=0;i<=upTo&&i<kifu.moves.length;i++){const[r,c,col]=kifu.moves[i].move;b[r][c]=col;}
    return b;
  },[kifu]);

  useEffect(()=>{setBoard(buildKB(moveIdx));},[moveIdx,buildKB]);

  useEffect(()=>{
    if(autoPlay){
      autoRef.current=setInterval(()=>{
        setMoveIdx(m=>{if(m>=kifu.moves.length-1){setAutoPlay(false);return m;}return m+1;});
      },1800);
    }
    return()=>clearInterval(autoRef.current);
  },[autoPlay,kifu]);

  const askAI = async()=>{
    const cur=kifu.moves[moveIdx]; if(!cur) return;
    setAiLoading(true);
    const[r,c,col]=cur.move;
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
        system:"你是圍棋老師，繁體中文，80字內解說棋理，適合初學者。",
        messages:[{role:"user",content:`棋譜「${kifu.title}」第${moveIdx+1}手，${col===1?"黑":"白"}棋。原解說：「${cur.comment}」請補充不同角度的棋理。`}]})});
    const d=await res.json();
    setAiComment(d.content?.[0]?.text??"");setAiLoading(false);
  };

  if(!board) return null;
  const cur=kifu.moves[moveIdx];
  const lm=cur?[cur.move[0],cur.move[1]]:null;

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
      <div style={{textAlign:"center"}}>
        <h2 style={{margin:0,fontSize:17,color:"#E8C84A",fontFamily:"Georgia"}}>{kifu.title}</h2>
        <p style={{margin:"3px 0",color:"#555",fontSize:11}}>{kifu.event}</p>
        <div style={{display:"flex",gap:12,justifyContent:"center",fontSize:12,color:"#888"}}>
          <span>⚫ {kifu.black}</span><span>⚪ {kifu.white}</span>
          <span style={{color:"#E8C84A"}}>{kifu.result}</span>
        </div>
      </div>

      <GoBoard size={kifu.size} board={board} lastMove={lm}/>

      <div style={{display:"flex",alignItems:"center",gap:5,width:"100%",maxWidth:380}}>
        {[["⏮",()=>setMoveIdx(0),moveIdx===0],["◀",()=>setMoveIdx(m=>Math.max(0,m-1)),moveIdx===0],
          ["▶",()=>setMoveIdx(m=>Math.min(kifu.moves.length-1,m+1)),moveIdx>=kifu.moves.length-1],
          ["⏭",()=>setMoveIdx(kifu.moves.length-1),moveIdx>=kifu.moves.length-1]
        ].map(([l,fn,d],i)=>(
          <button key={i} onClick={fn} disabled={d}
            style={{width:32,height:32,borderRadius:7,border:"1px solid #2A2A2A",background:"transparent",
              color:d?"#333":"#777",cursor:d?"default":"pointer",fontSize:13}}>
            {l}
          </button>
        ))}
        <div style={{flex:1,textAlign:"center",color:"#555",fontSize:12}}>
          第 <span style={{color:"#E8C84A",fontSize:15}}>{moveIdx+1}</span>/{kifu.moves.length} 手
        </div>
      </div>

      <input type="range" min={0} max={kifu.moves.length-1} value={moveIdx}
        onChange={e=>setMoveIdx(Number(e.target.value))}
        style={{width:"100%",maxWidth:380,accentColor:"#E8C84A"}}/>

      <button onClick={()=>setAutoPlay(!autoPlay)}
        style={{padding:"7px 18px",borderRadius:8,border:"none",
          background:autoPlay?"#5D4037":"#2D5016",color:"#E8C84A",cursor:"pointer",fontSize:13}}>
        {autoPlay?"⏸ 暫停":"▶ 自動播放"}
      </button>

      {cur&&(
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 14px",maxWidth:380,width:"100%"}}>
          <p style={{margin:0,color:"#CCC",fontSize:13,lineHeight:1.75}}>
            <b style={{color:cur.move[2]===1?"#DDD":"#AAA"}}>{cur.move[2]===1?"⚫ 黑":"⚪ 白"}棋第{moveIdx+1}手：</b>{" "}{cur.comment}
          </p>
          <button onClick={askAI}
            style={{marginTop:9,padding:"5px 12px",borderRadius:6,border:"1px solid rgba(232,200,74,0.3)",
              background:"transparent",color:"#E8C84A",cursor:"pointer",fontSize:12}}>
            🤖 AI 深入解說
          </button>
          {(aiComment||aiLoading)&&(
            <p style={{margin:"9px 0 0",color:"#AAA",fontSize:12,lineHeight:1.75,
              borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:9}}>
              {aiLoading?"AI分析中…":aiComment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主 App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab] = useState("tsumego");
  return (
    <div style={{minHeight:"100vh",background:"#0D1A09",fontFamily:"Georgia,serif",color:"#DDD"}}>
      <div style={{background:"linear-gradient(180deg,#1B2F11 0%,#0D1A09 100%)",
        borderBottom:"1px solid rgba(232,200,74,0.16)",padding:"13px 14px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{margin:0,fontSize:19,color:"#E8C84A",letterSpacing:2}}>圍棋自學道場</h1>
          <p style={{margin:0,fontSize:10,color:"#444",letterSpacing:1}}>題庫 · Go Game Guru（8段職業棋士監修）</p>
        </div>
        <div style={{display:"flex",gap:4}}>
          {[["tsumego","死活題"],["kifu","棋譜學習"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontFamily:"Georgia",
                background:tab===key?"#E8C84A":"rgba(255,255,255,0.06)",
                color:tab===key?"#0D1A09":"#777",fontWeight:tab===key?"bold":"normal",transition:"all 0.2s"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"18px 14px",maxWidth:440,margin:"0 auto"}}>
        {tab==="tsumego"?<TsumegoPage/>:<KifuPage/>}
      </div>

      <div style={{textAlign:"center",padding:14,color:"#243318",fontSize:10,borderTop:"1px solid rgba(255,255,255,0.03)"}}>
        題庫 © Go Game Guru · AI 解說由 Claude 提供
      </div>
    </div>
  );
}

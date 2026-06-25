// ==================== 游戏状态与数据 ====================
const GAME_CONFIG = {
  MATH_X_MIN: -10.0,
  MATH_X_MAX: 10.0,
  MATH_Y_MIN: -7.5,
  MATH_Y_MAX: 7.5
};

// 精心设计的关卡库
const LEVELS = [
  {
    id: 1,
    name: "初出茅庐 (斜率击破)",
    player: { x: -8, y: 0 },
    enemies: [
      { name: "靶怪 Alpha", x: 4, y: 3, radius: 0.6, hp: 100, maxHp: 100 }
    ],
    obstacles: [],
    ammo: 3,
    hint: "提示：目标在 (4, 3)，你可以计算斜率绘制直线击中它。试试：0.25*(x + 8)"
  },
  {
    id: 2,
    name: "山丘防御 (正弦穿梭)",
    player: { x: -8, y: -2 },
    enemies: [
      { name: "隐蔽潜行者", x: 6, y: -2, radius: 0.5, hp: 100, maxHp: 100 }
    ],
    obstacles: [
      { type: 'circle', x: 0, y: -2, radius: 2.0, label: "反导力场" }
    ],
    ammo: 4,
    hint: "提示：障碍物在正中间。你可以利用正弦波绕过去！试试：4 * sin(0.5 * x) - 2"
  },
  {
    id: 3,
    name: "天外降临 (高空轰炸)",
    player: { x: -7, y: -3 },
    enemies: [
      { name: "堡垒核心", x: 7, y: -3, radius: 0.7, hp: 100, maxHp: 100 }
    ],
    obstacles: [
      { type: 'circle', x: 0, y: -4, radius: 3.5, label: "钢铁山脉" }
    ],
    ammo: 3,
    hint: "提示：中间耸立着一座巨大的巨石，利用抛物线高空轰炸！试试：-0.15 * x^2 + 5"
  },
  {
    id: 4,
    name: "双向包夹 (弹道折返)",
    player: { x: -8, y: 0 },
    enemies: [
      { name: "浮空怪 I", x: 3, y: 3, radius: 0.5, hp: 100, maxHp: 100 },
      { name: "潜地怪 II", x: 7, y: -4, radius: 0.5, hp: 100, maxHp: 100 }
    ],
    obstacles: [
      { type: 'circle', x: 1, y: 0, radius: 2.5, label: "中心路障" }
    ],
    ammo: 5,
    hint: "提示：有两个怪物！可以使用多发子弹分别击灭，也可以用复杂的奇妙公式。试试：abs(x) - 4"
  },
  {
    id: 5,
    name: "最终试炼 (微积分大师)",
    player: { x: -9, y: 3 },
    enemies: [
      { name: "大领主 Megatron", x: 8, y: -4, radius: 0.9, hp: 200, maxHp: 200 }
    ],
    obstacles: [
      { type: 'circle', x: -2, y: 2, radius: 2.5, label: "引力陷阱" },
      { type: 'circle', x: 4, y: -1, radius: 2.2, label: "斥力力场" }
    ],
    ammo: 5,
    hint: "提示：多重力场交织！发挥出你全部的数学智慧吧。试试：0.08 * (x + 3)^2 - 4"
  }
];

let currentLevelIndex = 0;
let score = 0;
let isEndlessMode = false;
let levelData = {}; // 深度克隆的当前关卡数据
let lastBulletPath = null; // 上一次发射的完整轨迹（用作淡出参考线）
let firedPathsHistory = []; // 发射历史

// 粒子爆炸效果
let particles = [];

// 弹道动画状态
let bulletAnim = {
  active: false,
  currentX: 0,
  rpn: null,
  formula: "",
  points: [] // 已经走过的像素坐标点，绘制路径用
};
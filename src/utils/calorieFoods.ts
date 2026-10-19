export interface FoodItem {
  emoji: string;
  name: string;
  kcal: number;
}

export const FOOD_DATABASE: FoodItem[] = [
  { emoji: '🍔', name: '汉堡', kcal: 500 },
  { emoji: '🥩', name: '牛排', kcal: 450 },
  { emoji: '🍕', name: '披萨', kcal: 280 },
  { emoji: '🍩', name: '甜甜圈', kcal: 240 },
  { emoji: '🍗', name: '鸡腿', kcal: 180 },
  { emoji: '🥑', name: '牛油果', kcal: 160 },
  { emoji: '🍌', name: '香蕉', kcal: 90 },
  { emoji: '🥚', name: '水煮蛋', kcal: 70 },
  { emoji: '🍎', name: '苹果', kcal: 50 },
  { emoji: '☕', name: '美式咖啡', kcal: 10 },
];

export interface FoodEquivalentResult {
  emojis: string;
  description: string;
  totalEquivKcal: number;
  items: { item: FoodItem; count: number }[];
}

export function getCalorieFoodEquivalents(kcal: number): FoodEquivalentResult {
  if (!kcal || kcal <= 0) {
    return {
      emojis: '',
      description: '暂无消耗记录',
      totalEquivKcal: 0,
      items: [],
    };
  }

  let remaining = Math.round(kcal);
  const items: { item: FoodItem; count: number }[] = [];

  for (const food of FOOD_DATABASE) {
    if (remaining >= food.kcal) {
      const count = Math.floor(remaining / food.kcal);
      items.push({ item: food, count });
      remaining -= count * food.kcal;
    }
    // Keep combination clean and readable: limit to top 3 types of food
    if (items.length >= 3) break;
  }

  if (items.length === 0) {
    items.push({ item: FOOD_DATABASE[8], count: 1 }); // Default to 1 Apple
  }

  const emojis = items.map((i) => i.item.emoji.repeat(Math.min(i.count, 4))).join(' ');
  const description = items.map((i) => `${i.item.name} × ${i.count}`).join(' + ');
  const totalEquivKcal = items.reduce((sum, i) => sum + i.item.kcal * i.count, 0);

  return { emojis, description, totalEquivKcal, items };
}

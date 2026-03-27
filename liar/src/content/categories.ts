export interface LiarCategory {
  readonly id: string;
  readonly label: string;
  readonly words: readonly string[];
}

export const liarCategories: readonly LiarCategory[] = [
  {
    id: "food",
    label: "음식",
    words: ["김치찌개", "비빔밥", "떡볶이", "초밥", "햄버거", "짜장면", "에스프레소", "붕어빵"],
  },
  {
    id: "animal",
    label: "동물",
    words: ["호랑이", "사자", "고양이", "강아지", "돌고래", "펭귄", "토끼", "코끼리"],
  },
  {
    id: "job",
    label: "직업",
    words: ["요리사", "경찰관", "교사", "소방관", "간호사", "기자", "프로그래머", "배우"],
  },
  {
    id: "place",
    label: "장소",
    words: ["도서관", "공항", "놀이공원", "지하철역", "카페", "수영장", "영화관", "박물관"],
  },
] as const;

export function getLiarCategory(categoryId: string): LiarCategory | null {
  return liarCategories.find((category) => category.id === categoryId) ?? null;
}

export function getDefaultLiarCategory(): LiarCategory {
  return liarCategories[0];
}

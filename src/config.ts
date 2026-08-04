// 프로젝트 설정: BASE_URL, DEMO_ACCOUNT, DEFAULT_PROFILE_IMAGE, HEADER_TITLE, SPLASH_ITEMS.
export const BASE_URL: string = import.meta.env?.VITE_API_BASE_URL || '/api/v1';

// 공개 데모용 계정. 백엔드의 시드 스크립트(scripts/seed_demo.py)가 만드는 계정과 같은 값이며,
// 처음 온 사람이 가입 없이 로그인 이후 화면(알림·DM·내 글)까지 둘러볼 수 있게 로그인 화면에 노출한다.
// 값이 바뀌면 양쪽을 함께 고쳐야 한다.
export const DEMO_ACCOUNT = {
  email: 'demo@puppytalk.shop',
  password: 'PuppyTalk!demo1',
} as const;
export const DEFAULT_PROFILE_IMAGE = '/imt.png';
export const HEADER_TITLE = '퍼피톡';

export interface SplashItem {
  path: string;
  duration: number;
}

export const SPLASH_ITEMS: SplashItem[] = [
  { path: '/anim1.json', duration: 1000 },
  { path: '/anim2.json', duration: 1000 },
  { path: '/anim3.json', duration: 1000 },
];

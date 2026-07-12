// 외부 스크립트로 주입되는 전역(런타임 선택적).

interface LottieAnimation {
  destroy(): void;
}

interface LottiePlayer {
  loadAnimation(options: {
    container: Element;
    renderer?: string;
    loop?: boolean;
    autoplay?: boolean;
    path?: string;
  }): LottieAnimation;
}

interface Window {
  lottie?: LottiePlayer;
}

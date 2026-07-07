// Razorpay global typings.
// Keep this single source of truth to avoid duplicate/competing `Window.Razorpay`
// declarations (TypeScript error: "All declarations of 'Razorpay' must have identical modifiers").

export {};

declare global {
  interface Window {
    Razorpay?: any;
  }
}


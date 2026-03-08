import { useEffect, useRef, useState, useCallback } from "react";

let globalShowToast: (text: string) => void = () => {};

export function showToast(text: string) {
  globalShowToast(text);
}

export default function Toast() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((msg: string) => {
    setText(msg);
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  useEffect(() => {
    globalShowToast = show;
    return () => {
      globalShowToast = (_: string) => {};
    };
  }, [show]);

  return <div className={`toast${visible ? " show" : ""}`}>{text}</div>;
}

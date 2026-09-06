"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function AppToaster() {
  return (
    <ToastContainer
      position="top-center"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      draggable
      theme="light"
      limit={3}
      style={{
        zIndex: 200,
        top: "0.75rem",
        left: "0.75rem",
        right: "0.75rem",
        width: "auto",
        maxWidth: "28rem",
        margin: "0 auto",
      }}
      toastClassName="!rounded-2xl !text-sm !shadow-lg"
    />
  );
}

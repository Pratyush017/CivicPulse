"use client";

import React from "react";
import { motion, Variants } from "motion/react";

interface BlurTextProps {
  text: string;
  delay?: number;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom" | "left" | "right";
  className?: string;
  onAnimationComplete?: () => void;
}

export default function BlurText({
  text,
  delay = 200,
  animateBy = "words",
  direction = "top",
  className = "",
  onAnimationComplete,
}: BlurTextProps) {
  const elements =
    animateBy === "words" ? text.split(" ") : text.split("");

  const getTransform = (dir: string) => {
    switch (dir) {
      case "top":
        return -50;
      case "bottom":
        return 50;
      default:
        return 0;
    }
  };

  const getTransformX = (dir: string) => {
    switch (dir) {
      case "left":
        return -50;
      case "right":
        return 50;
      default:
        return 0;
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay / 1000,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      filter: "blur(10px)",
      y: getTransform(direction),
      x: getTransformX(direction),
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      x: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`inline-flex ${className}`}
      onAnimationComplete={onAnimationComplete}
    >
      {elements.map((el, i) => (
        <motion.span
          key={i}
          variants={itemVariants}
          className="inline-block"
          style={animateBy === "words" && i < elements.length - 1 ? { marginRight: "0.25em" } : {}}
        >
          {el === " " ? "\u00A0" : el}
        </motion.span>
      ))}
    </motion.div>
  );
}

"use client";

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: "view" | "hover";
  clickMode?: "toggle" | "once";
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "hover",
  clickMode,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const iterationRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    iterationRef.current = 0;
    
    if (timeoutRef.current) clearInterval(timeoutRef.current);
    
    timeoutRef.current = setInterval(() => {
      setDisplayText((currentText) => {
        const newText = text.split("").map((letter, index) => {
          if (letter === " ") return " ";
          
          let iterationLimit = maxIterations;
          if (sequential) {
            if (revealDirection === "start") {
              iterationLimit = maxIterations + index * 2;
            } else if (revealDirection === "end") {
              iterationLimit = maxIterations + (text.length - index) * 2;
            }
          }
          
          if (iterationRef.current >= iterationLimit) {
            return text[index];
          }
          
          if (useOriginalCharsOnly) {
            return text[Math.floor(Math.random() * text.length)];
          }
          
          return characters[Math.floor(Math.random() * characters.length)];
        });
        
        iterationRef.current += 1;
        
        const maxTotalIterations = sequential ? maxIterations + text.length * 2 : maxIterations;
        if (iterationRef.current >= maxTotalIterations) {
          if (timeoutRef.current) clearInterval(timeoutRef.current);
          setIsAnimating(false);
          return text;
        }
        
        return newText.join("");
      });
    }, speed);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (animateOn === "hover") {
      setIsHovering(true);
      startAnimation();
    }
  };

  const handleMouseLeave = () => {
    if (animateOn === "hover") {
      setIsHovering(false);
      if (timeoutRef.current) clearInterval(timeoutRef.current);
      setIsAnimating(false);
      setDisplayText(text);
    }
  };

  return (
    <motion.span
      className={`inline-block ${parentClassName}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => clickMode && startAnimation()}
    >
      <span className={isAnimating || isHovering ? encryptedClassName : className}>
        {displayText}
      </span>
    </motion.span>
  );
}

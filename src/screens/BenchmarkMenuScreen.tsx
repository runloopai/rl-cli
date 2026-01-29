/**
 * BenchmarkMenuScreen - Benchmark sub-menu using navigation context
 */
import React from "react";
import { useNavigation, type ScreenName } from "../store/navigationStore.js";
import { BenchmarkMenu } from "../components/BenchmarkMenu.js";

export function BenchmarkMenuScreen() {
  const { navigate, goBack } = useNavigation();

  const handleSelect = (key: string) => {
    switch (key) {
      case "benchmarks":
        navigate("benchmark-list");
        break;
      case "benchmark-runs":
        navigate("benchmark-run-list");
        break;
      case "benchmark-jobs":
        navigate("benchmark-job-list");
        break;
      case "scenario-runs":
        navigate("scenario-run-list");
        break;
      default:
        // Fallback for any other screen names
        navigate(key as ScreenName);
    }
  };

  const handleBack = () => {
    goBack();
  };

  return <BenchmarkMenu onSelect={handleSelect} onBack={handleBack} />;
}

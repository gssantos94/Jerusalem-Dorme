import { useContext } from "react";
import { GameContext } from "./game-context-object";

export const useGame = () => useContext(GameContext);

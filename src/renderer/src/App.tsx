// src/renderer/src/App.tsx
import { ChakraProvider, defaultSystem, Box, Flex } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import Canvas from "./components/canvas/canvas";
import Footer from "./components/footer/footer";
import { AiStateProvider } from "./context/ai-state-context";
import { Live2DConfigProvider } from "./context/live2d-config-context";
import { SubtitleProvider } from "./context/subtitle-context";
import { BgUrlProvider } from "./context/bgurl-context";
import { CameraProvider } from "@/context/camera-context";
import WebSocketHandler from "./services/websocket-handler";
import { ChatHistoryProvider } from "./context/chat-history-context";
import { CharacterConfigProvider } from "./context/character-config-context";
import { Toaster } from "./components/ui/toaster";
import { VADProvider } from "./context/vad-context";
import { Live2D } from "./components/canvas/live2d";
import TitleBar from "./components/electron/title-bar";
import { Live2DModelProvider } from "./context/live2d-model-context";
import { InputSubtitle } from "./components/electron/input-subtitle";
import { useStartupInitialization } from "./hooks/utils/use-startup-initialization";
import { useDebugStartup } from "@/hooks/utils/use-debug-startup";
import { STTProvider } from "@/context/stt-context";
import { EnhancedWebSocketProvider } from "@/context/websocket-context";
import { useSimpleOBSPolyfill } from "@/hooks/utils/use-simple-obs-polyfill";
import { useAppKeybinds } from "@/hooks/utils/use-app-keybinds";
import { CustomExpressionTester } from "./utils/test-custom-expressions";
// OBS Integration Components
import { OBSFloatingButton } from "./components/obs/obs-floating-button";

const layoutStyles = {
  appContainer: {
    width: "100vw",
    height: "calc(100vh - 30px)",
    bg: "gray.900",
    color: "white",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  mainContent: {
    flex: 1,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    overflow: "hidden",
  },
  footer: {
    width: "100%",
    height: "186px",
    position: "relative",
    zIndex: 1,
  },
  collapsedFooter: {
    height: "24px",
  },
} as const;

/**
 * Internal App Component that has access to all context providers
 * This component handles the startup initialization logic and keybind system
 */
function AppInternal(): JSX.Element {
  useSimpleOBSPolyfill();
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [mode, setMode] = useState("window");
  const isElectron = window.api !== undefined;

  // Initialize startup restoration process
  const { initPhase, hasCompletedInit, getInitializationStatus } =
    useStartupInitialization();

  // Initialize the keybind system with all VTuber features
  const keybindSystem = useAppKeybinds({
    enabled: true,
    showNotifications: true,
    showHelpOnLoad: true, // Show help notification after startup
    debugMode: true, // Enable debug mode to troubleshoot
  });

  // Debug startup process and keybind system (can be removed in production)
  useDebugStartup();

  // Debug info for keybind system
  useEffect(() => {
    console.log("🎥 App Debug Info:", {
      mode,
      isElectron,
      hasWindowApi: !!window.api,
      apiMethods: window.api ? Object.keys(window.api).length : 0,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      keybinds: {
        enabled: keybindSystem.isEnabled,
        registeredCount: keybindSystem.registeredKeybindsCount,
        featureStatus: keybindSystem.getFeatureStatus(),
      },
    });
  }, [mode, isElectron, keybindSystem]);

  // Show keybind instructions after initialization
  useEffect(() => {
    if (hasCompletedInit && keybindSystem.isEnabled) {
      const featureStatus = keybindSystem.getFeatureStatus();
      console.log("🎹 Keybind System Status:", featureStatus);

      // Show welcome notification with keybind info
      setTimeout(() => {
        console.log("💡 VTuber Keybinds Available:");
        console.log("=== SINGLE KEY SHORTCUTS (when not typing) ===");
        console.log("  U - Toggle UI visibility");
        console.log("  M - Toggle cursor follow/random look");
        console.log("  E - Next expression");
        console.log("  Q - Previous expression");
        console.log("  T - Auto-test all expressions");
        console.log("  R - Random look (when in random mode)");
        console.log("  C - Look at center");
        console.log("  D - Refresh expressions list");
        console.log("  ? - Show detailed help");
        console.log("  F2 - Show help");
        console.log("  Escape - Reset to default expression");
        console.log("=== MODIFIER KEY SHORTCUTS ===");
        console.log(
          `  ${navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl"}+H - Toggle UI visibility`
        );
        console.log(
          `  ${navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl"}+F - Toggle cursor follow`
        );
        console.log("  Shift+Space - Quick UI toggle");
        console.log("");
        console.log(
          "💡 Tip: These shortcuts work when not typing in text fields!"
        );
      }, 2000);
    }
  }, [hasCompletedInit, keybindSystem]);

  // Log initialization progress (can be removed in production)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const status = getInitializationStatus();
      console.log("Initialization Status:", status);
    }
  }, [initPhase, getInitializationStatus]);

  useEffect(() => {
    if (isElectron) {
      window.electron.ipcRenderer.on("pre-mode-changed", (_event, newMode) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.electron.ipcRenderer.send(
              "renderer-ready-for-mode-change",
              newMode
            );
          });
        });
      });
    }
  }, [isElectron]);

  useEffect(() => {
    if (isElectron) {
      window.electron.ipcRenderer.on("mode-changed", (_event, newMode) => {
        setMode(newMode);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.electron.ipcRenderer.send("mode-change-rendered");
          });
        });
      });
    }
  }, [isElectron]);

  // Handle OBS mode change events (from the polyfill)
  useEffect(() => {
    const handleOBSModeChange = (event: CustomEvent) => {
      const { mode: newMode } = event.detail;
      console.log(`🎬 OBS triggered mode change to: ${newMode}`);
      setMode(newMode);
    };

    document.addEventListener(
      "obs-mode-change",
      handleOBSModeChange as EventListener
    );

    return () => {
      document.removeEventListener(
        "obs-mode-change",
        handleOBSModeChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add data attributes for keybind system to identify elements
  useEffect(() => {
    // Add testid attributes for the UI toggle system
    const footer = document.querySelector('footer, [class*="footer"]');
    if (footer && !footer.getAttribute("data-testid")) {
      footer.setAttribute("data-testid", "footer");
    }

    const titleBar = document.querySelector(
      '[class*="titleBar"], [class*="title-bar"]'
    );
    if (titleBar && !titleBar.getAttribute("data-testid")) {
      titleBar.setAttribute("data-testid", "title-bar");
    }
  }, [mode]);

  return (
    <>
      <Toaster />
      {mode === "window" ? (
        <>
          {isElectron && <TitleBar />}
          <Flex {...layoutStyles.appContainer}>
            <Box {...layoutStyles.mainContent}>
              <Canvas />
              <Box
                {...layoutStyles.footer}
                {...(isFooterCollapsed && layoutStyles.collapsedFooter)}
                data-testid="footer"
              >
                <Footer
                  isCollapsed={isFooterCollapsed}
                  onToggle={() => setIsFooterCollapsed(!isFooterCollapsed)}
                />
              </Box>
            </Box>

            {/* OBS Integration Button */}
            <OBSFloatingButton />
          </Flex>
        </>
      ) : (
        <>
          <Live2D isPet={mode === "pet"} />
          {mode === "pet" && <InputSubtitle isPet={mode === "pet"} />}
        </>
      )}
    </>
  );
}

/**
 * Main App Component with all context providers
 * Provider Order (dependencies must come before dependents):
 * 1. ChakraProvider - UI foundation
 * 2. Live2DModelProvider - Core model management (IMPORTANT: Must be early for keybinds)
 * 3. CharacterConfigProvider - Character configuration
 * 4. ChatHistoryProvider - Message history
 * 5. AiStateProvider - AI state management
 * 6. Live2DConfigProvider - Live2D configuration
 * 7. SubtitleProvider - Subtitle/text display
 * 8. EnhancedWebSocketProvider - Core WebSocket connection and state management
 * 9. STTProvider - Speech-to-text services
 * 10. VADProvider - Voice activity detection
 * 11. CameraProvider - Camera services
 * 12. BgUrlProvider - Background management
 * 13. WebSocketHandler - WebSocket message processing with integrated audio handling
 */
function App(): JSX.Element {
  return (
    <ChakraProvider value={defaultSystem}>
      <Live2DModelProvider>
        <CharacterConfigProvider>
          <ChatHistoryProvider>
            <AiStateProvider>
              <Live2DConfigProvider>
                  <SubtitleProvider>
                    <EnhancedWebSocketProvider>
                      <STTProvider>
                        <VADProvider>
                          <CameraProvider>
                            <BgUrlProvider>
                              <WebSocketHandler>
                                <AppInternal />
                              </WebSocketHandler>
                            </BgUrlProvider>
                          </CameraProvider>
                        </VADProvider>
                      </STTProvider>
                    </EnhancedWebSocketProvider>
                  </SubtitleProvider>
              </Live2DConfigProvider>
            </AiStateProvider>
          </ChatHistoryProvider>
        </CharacterConfigProvider>
      </Live2DModelProvider>
    </ChakraProvider>
  );
}

export default App;

import { useState, useEffect } from "react";
import {
  Button,
  Box,
  Flex,
  VStack,
  useDisclosure,
  Dialog,
  Portal,
  Checkbox,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useEula } from "../../context/eula-context";
import { eulaTextEn } from "../../locales/en/eula";
import { eulaTextZh } from "../../locales/zh/eula";

/**
 * EULA Modal component that displays the End User License Agreement
 * The modal cannot be closed until the user accepts the agreement
 */
export function EulaModal() {
  const disclosure = useDisclosure();
  const { hasAcceptedEula, setHasAcceptedEula } = useEula();
  const [isChecked, setIsChecked] = useState(false);
  const { i18n } = useTranslation();
  
  // Use i18n.language directly for EULA language instead of a separate state
  const eulaLanguage = i18n.language.startsWith("zh") ? "zh" : "en";

  // Open the modal if EULA has not been accepted
  useEffect(() => {
    if (!hasAcceptedEula) {
      disclosure.onOpen();
    }
  }, [hasAcceptedEula, disclosure]);

  // Handle EULA acceptance
  const handleAccept = () => {
    setHasAcceptedEula(true);
    disclosure.onClose();
  };

  // Disable closing by escape key or clicking outside
  const handleAttemptClose = () => {
    // Only allow closing if EULA has been accepted
    if (hasAcceptedEula) {
      disclosure.onClose();
    }
  };

  // Get the EULA text based on selected language
  const getEulaText = () => {
    return eulaLanguage === "en" ? eulaTextEn : eulaTextZh;
  };

  return (
    <Dialog.Root
      open={disclosure.open}
      onOpenChange={(e) =>
        e.open ? disclosure.onOpen() : handleAttemptClose()
      }
      closeOnEscape={hasAcceptedEula}
      closeOnInteractOutside={hasAcceptedEula}
      size="xl"
      scrollBehavior="inside"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="800px" maxH="80vh">
            <Dialog.Header>
              <Flex
                justifyContent="space-between"
                alignItems="center"
                width="100%"
              >
                <Box flex="1">
                  {eulaLanguage === "en"
                    ? "End User License Agreement (EULA)"
                    : "最终用户许可协议 (EULA)"}
                </Box>
                <Box>
                  <select
                    value={eulaLanguage}
                    onChange={(e) => {
                      i18n.changeLanguage(e.target.value as "en" | "zh");
                    }}
                    style={{
                      width: "130px",
                      padding: "4px 8px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="en">English (英语)</option>
                    <option value="zh">中文 (Chinese)</option>
                  </select>
                </Box>
              </Flex>
            </Dialog.Header>

            {hasAcceptedEula && <Dialog.CloseTrigger />}

            <Dialog.Body>
              <Box
                bg="gray.50"
                p={4}
                borderRadius="md"
                whiteSpace="pre-wrap"
                overflowY="auto"
                height="400px"
                dangerouslySetInnerHTML={{ __html: getEulaText() }}
                css={{
                  "& h2": {
                    fontSize: "1.5em",
                    fontWeight: "bold",
                  },
                  "& strong": {
                    fontWeight: "bold",
                  },
                }}
              >
                {/* {getEulaText()} */}
              </Box>
            </Dialog.Body>

            <Dialog.Footer>
              <VStack w="100%" gap={4} align="stretch">
                <Flex align="center" ml={3}>
                  <Checkbox.Root
                    checked={isChecked}
                    onCheckedChange={(e) => setIsChecked(!!e.checked)}
                    colorPalette="blue"
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>
                      {eulaLanguage === "en"
                        ? "I have read and agree to the terms and conditions"
                        : "我已阅读并同意本协议的条款和条件"}
                    </Checkbox.Label>
                  </Checkbox.Root>
                </Flex>

                <Flex justify="flex-end">
                  <Button
                    colorPalette="blue"
                    disabled={!isChecked}
                    onClick={handleAccept}
                  >
                    {eulaLanguage === "en" ? "Accept" : "接受"}
                  </Button>
                </Flex>
              </VStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

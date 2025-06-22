import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Input,
  Textarea,
  NativeSelect,
  Switch,
  Field,
  Dialog,
  Portal,
  Table,
  Badge,
  Alert,
  Accordion,
  Flex,
  Spacer,
  Separator,
  Card,
  Tabs,
  Progress,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useLive2DModel } from '@/context/live2d-model-context';
import { toaster } from '@/components/ui/toaster';
import {
  CustomExpressionMapping,
  CustomExpressionParameter,
  CreateCustomExpressionRequest,
  ModelParameter,
  generateCustomExpressionId,
  validateCustomExpressionMapping,
} from '@/types/custom-expression-types';
import { customExpressionManager } from '@/services/custom-expression-manager';
import { parameterDiscoveryService } from '@/services/parameter-discovery-service';

interface CustomExpressionSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExpressionFormData {
  name: string;
  description: string;
  parameters: CustomExpressionParameter[];
}

const INITIAL_FORM_DATA: ExpressionFormData = {
  name: '',
  description: '',
  parameters: [],
};

// Icon components as simple SVG since @chakra-ui/icons may not be available in v3
const AddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
);

const RepeatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

export function CustomExpressionSettingsPanel({ isOpen, onClose }: CustomExpressionSettingsPanelProps) {
  const { modelInfo } = useLive2DConfig();
  const { currentModel } = useLive2DModel();
  
  // State
  const [customExpressions, setCustomExpressions] = useState<CustomExpressionMapping[]>([]);
  const [availableParameters, setAvailableParameters] = useState<ModelParameter[]>([]);
  const [categorizedParameters, setCategorizedParameters] = useState<Record<string, ModelParameter[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExpression, setSelectedExpression] = useState<CustomExpressionMapping | null>(null);
  const [formData, setFormData] = useState<ExpressionFormData>(INITIAL_FORM_DATA);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Expression');
  const [stats, setStats] = useState<any>(null);

  // Modal controls
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Initialize and load data
  useEffect(() => {
    if (isOpen && currentModel && modelInfo?.name) {
      loadData();
    }
  }, [isOpen, currentModel, modelInfo?.name]);

  const loadData = useCallback(async () => {
    if (!currentModel || !modelInfo?.name) return;

    setIsLoading(true);
    try {
      // Initialize custom expression manager with CDI3 support
      await customExpressionManager.initialize(
        currentModel, 
        modelInfo.name,
        modelInfo.localModelPath // Pass model path for CDI3 discovery
      );
      
      // Load custom expressions
      const expressions = customExpressionManager.getCustomExpressions();
      setCustomExpressions(expressions);

      // Load available parameters (CDI3 enhanced)
      const allParams = customExpressionManager.getAvailableParameters();
      const categorized = customExpressionManager.getParametersByCategory();
      
      setAvailableParameters(allParams);
      setCategorizedParameters(categorized);

      // Load statistics
      const statistics = customExpressionManager.getParameterStatistics();
      setStats(statistics);

      console.log(`📊 Loaded ${expressions.length} custom expressions and ${allParams.length} parameters${statistics.cdi3Enhanced ? ' (CDI3 enhanced)' : ''}`);
      
      if (statistics.cdi3Enhanced) {
        toaster.create({
          title: 'CDI3 Enhanced',
          description: `Loaded ${statistics.total} parameters with CDI3 enhancement`,
          type: 'info',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to load custom expression data:', error);
      toaster.create({
        title: 'Loading Failed',
        description: 'Failed to load custom expression data',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentModel, modelInfo?.name, modelInfo?.localModelPath]);

  // Filtered parameters based on search and category
  const filteredParameters = useMemo(() => {
    let params = selectedCategory === 'All' ? availableParameters : (categorizedParameters[selectedCategory] || []);
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      params = params.filter(p => {
        const paramWithMeta = p as ModelParameter & {
          cdi3Description?: string;
          cdi3Category?: string;
        };
        
        return (
          p.name.toLowerCase().includes(query) || 
          p.id.toLowerCase().includes(query) ||
          (paramWithMeta.cdi3Description && paramWithMeta.cdi3Description.toLowerCase().includes(query))
        );
      });
    }
    
    return params;
  }, [availableParameters, categorizedParameters, selectedCategory, searchQuery]);

  // Available categories
  const categories = useMemo(() => {
    const cats = ['All', ...Object.keys(categorizedParameters)];
    return cats;
  }, [categorizedParameters]);

  // Handle create expression
  const handleCreateExpression = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setValidationErrors([]);
    setSelectedExpression(null);
    setIsCreateModalOpen(true);
  }, []);

  // Handle edit expression
  const handleEditExpression = useCallback((expression: CustomExpressionMapping) => {
    setFormData({
      name: expression.name,
      description: expression.description || '',
      parameters: [...expression.parameters],
    });
    setValidationErrors([]);
    setSelectedExpression(expression);
    setIsEditModalOpen(true);
  }, []);

  // Handle delete expression
  const handleDeleteExpression = useCallback(async (expressionId: string) => {
    if (!window.confirm('Are you sure you want to delete this custom expression?')) {
      return;
    }

    try {
      const success = await customExpressionManager.deleteCustomExpression(expressionId);
      if (success) {
        await loadData();
        toaster.create({
          title: 'Expression Deleted',
          description: 'Custom expression has been deleted',
          type: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Failed to delete expression:', error);
      toaster.create({
        title: 'Delete Failed',
        description: 'Failed to delete custom expression',
        type: 'error',
        duration: 3000,
      });
    }
  }, [loadData]);

  // Handle test expression
  const handleTestExpression = useCallback(async (expression: CustomExpressionMapping) => {
    try {
      const success = await customExpressionManager.applyCustomExpression(expression.name, 1.0, 1000);
      if (success) {
        toaster.create({
          title: 'Expression Applied',
          description: `Testing "${expression.name}" expression`,
          type: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Failed to test expression:', error);
      toaster.create({
        title: 'Test Failed',
        description: 'Failed to apply test expression',
        type: 'error',
        duration: 3000,
      });
    }
  }, []);

  // Handle save expression (create or update)
  const handleSaveExpression = useCallback(async () => {
    // Validate form
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('Expression name is required');
    }
    
    if (formData.parameters.length === 0) {
      errors.push('At least one parameter must be configured');
    }

    // Check for duplicate names
    const isDuplicate = customExpressionManager.isExpressionNameTaken(
      formData.name, 
      selectedExpression?.id
    );
    if (isDuplicate) {
      errors.push('Expression name already exists');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const request: CreateCustomExpressionRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        parameters: formData.parameters.map(p => ({
          parameterId: p.parameterId,
          targetValue: p.targetValue,
          weight: p.weight,
          blendMode: p.blendMode,
        })),
      };

      let success = false;

      if (selectedExpression) {
        // Update existing expression
        success = await customExpressionManager.updateCustomExpression(selectedExpression.id, request);
      } else {
        // Create new expression
        const newExpression = await customExpressionManager.createCustomExpression(request);
        success = !!newExpression;
      }

      if (success) {
        await loadData();
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        
        toaster.create({
          title: selectedExpression ? 'Expression Updated' : 'Expression Created',
          description: `Custom expression "${formData.name}" has been ${selectedExpression ? 'updated' : 'created'}`,
          type: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Failed to save expression:', error);
      toaster.create({
        title: 'Save Failed',
        description: 'Failed to save custom expression',
        type: 'error',
        duration: 3000,
      });
    }
  }, [formData, selectedExpression, loadData]);

  // Add parameter to form
  const addParameterToForm = useCallback((parameter: ModelParameter) => {
    const newParam: CustomExpressionParameter = {
      parameterId: parameter.id,
      parameterName: parameter.name,
      targetValue: parameter.maxValue > 1 ? 1.0 : parameter.maxValue,
      weight: 1.0,
      blendMode: 'overwrite',
    };

    setFormData(prev => ({
      ...prev,
      parameters: [...prev.parameters, newParam],
    }));
  }, []);

  // Remove parameter from form
  const removeParameterFromForm = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  }, []);

  // Update parameter in form
  const updateParameterInForm = useCallback((index: number, updates: Partial<CustomExpressionParameter>) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.map((param, i) => 
        i === index ? { ...param, ...updates } : param
      ),
    }));
  }, []);

  // Export expressions
  const handleExportExpressions = useCallback(() => {
    try {
      const exportData = customExpressionManager.exportCustomExpressions();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom-expressions-${modelInfo?.name}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toaster.create({
        title: 'Export Complete',
        description: 'Custom expressions exported successfully',
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to export expressions:', error);
      toaster.create({
        title: 'Export Failed',
        description: 'Failed to export custom expressions',
        type: 'error',
        duration: 3000,
      });
    }
  }, [modelInfo?.name]);

  if (!modelInfo?.name) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxWidth="xl">
              <Dialog.Header>
                <Dialog.Title>Custom Expressions</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="sm">✕</Button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Alert.Root status="info">
                  <Alert.Indicator>
                    <InfoIcon />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>No Model Loaded</Alert.Title>
                    <Alert.Description>
                      Please load a Live2D model to configure custom expressions.
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    );
  }

  if (isLoading) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxWidth="xl">
              <Dialog.Header>
                <Dialog.Title>Custom Expressions</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="sm">✕</Button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Center py={8}>
                  <VStack>
                    <Spinner size="xl" />
                    <Text>Loading custom expression data...</Text>
                    <Text fontSize="sm" color="gray.600">
                      Discovering parameters and CDI3 information
                    </Text>
                  </VStack>
                </Center>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    );
  }

  return (
    <>
      {/* Main Settings Panel */}
      <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxWidth="full" maxHeight="95vh">
              <Dialog.Header>
                <HStack>
                  <Dialog.Title>Custom Expressions</Dialog.Title>
                  <Badge colorScheme="blue">{modelInfo.name}</Badge>
                  {stats?.cdi3Enhanced && (
                    <Badge colorScheme="purple" variant="outline">
                      <StarIcon />
                      CDI3 Enhanced
                    </Badge>
                  )}
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="sm">✕</Button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <VStack spacing={6} align="stretch">
                  {/* CDI3 Enhancement Info */}
                  {stats?.cdi3Enhanced && (
                    <Alert.Root status="success" variant="leftAccent">
                      <Alert.Indicator>
                        <InfoIcon />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>CDI3 Enhanced Model Detected!</Alert.Title>
                        <Alert.Description>
                          This model includes CDI3 parameter definitions with enhanced metadata. 
                          Parameters are automatically categorized and include detailed descriptions.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {/* Action Bar */}
                  <HStack>
                    <Button 
                      onClick={handleCreateExpression}
                      disabled={isLoading}
                      colorScheme="blue"
                    >
                      <AddIcon />
                      Create Expression
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={loadData}
                      loading={isLoading}
                    >
                      <RepeatIcon />
                      Refresh
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleExportExpressions}
                      disabled={customExpressions.length === 0}
                    >
                      <DownloadIcon />
                      Export
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsStatsModalOpen(true)}
                      disabled={!stats}
                    >
                      <InfoIcon />
                      Statistics
                    </Button>
                    <Spacer />
                    <VStack align="end" spacing={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        {customExpressions.length} expressions configured
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        {stats?.enabledExpressions || 0} enabled
                      </Text>
                    </VStack>
                  </HStack>

                  <Tabs.Root defaultValue="expressions">
                    <Tabs.List>
                      <Tabs.Trigger value="expressions">Expressions ({customExpressions.length})</Tabs.Trigger>
                      <Tabs.Trigger value="parameters">Parameters ({availableParameters.length})</Tabs.Trigger>
                    </Tabs.List>

                    <Tabs.Content value="expressions" pt={4}>
                      {customExpressions.length === 0 ? (
                        <Alert.Root status="info">
                          <Alert.Indicator>
                            <InfoIcon />
                          </Alert.Indicator>
                          <Alert.Content>
                            <Alert.Title>No Custom Expressions</Alert.Title>
                            <Alert.Description>
                              Create your first custom expression to get started. Custom expressions map model parameters 
                              to expression names that can be used by the AI.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert.Root>
                      ) : (
                        <Table.Root variant="simple" size="sm">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader>Name</Table.ColumnHeader>
                              <Table.ColumnHeader>Description</Table.ColumnHeader>
                              <Table.ColumnHeader>Parameters</Table.ColumnHeader>
                              <Table.ColumnHeader>Status</Table.ColumnHeader>
                              <Table.ColumnHeader width="150px">Actions</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {customExpressions.map((expression) => (
                              <Table.Row key={expression.id}>
                                <Table.Cell>
                                  <Text fontWeight="medium">{expression.name}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                  <Text fontSize="sm" color="gray.600" noOfLines={2}>
                                    {expression.description || 'No description'}
                                  </Text>
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge variant="outline">
                                    {expression.parameters.length} params
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge colorScheme={expression.enabled ? 'green' : 'gray'}>
                                    {expression.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                  <HStack spacing={1}>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleTestExpression(expression)}
                                      title="Test Expression"
                                    >
                                      <ViewIcon />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditExpression(expression)}
                                      title="Edit Expression"
                                    >
                                      <EditIcon />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="red"
                                      onClick={() => handleDeleteExpression(expression.id)}
                                      title="Delete Expression"
                                    >
                                      <DeleteIcon />
                                    </Button>
                                  </HStack>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      )}
                    </Tabs.Content>

                    <Tabs.Content value="parameters" pt={4}>
                      <VStack spacing={4} align="stretch">
                        {/* Parameter Filters */}
                        <HStack>
                          <Field.Root width="200px">
                            <Field.Label fontSize="sm">Category</Field.Label>
                            <NativeSelect.Root 
                              size="sm" 
                              value={selectedCategory} 
                              onValueChange={(details) => setSelectedCategory(details.value)}
                            >
                              <NativeSelect.Field>
                                {categories.map(category => (
                                  <option key={category} value={category}>
                                    {category} ({category === 'All' ? availableParameters.length : (categorizedParameters[category]?.length || 0)})
                                  </option>
                                ))}
                              </NativeSelect.Field>
                              <NativeSelect.Indicator />
                            </NativeSelect.Root>
                          </Field.Root>
                          <Field.Root>
                            <Field.Label fontSize="sm">Search</Field.Label>
                            <Input 
                              size="sm" 
                              placeholder="Search parameters..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </Field.Root>
                        </HStack>
                        
                        <Box border="1px" borderColor="gray.200" rounded="md" maxHeight="400px" overflowY="auto">
                          <Table.Root variant="simple" size="sm">
                            <Table.Header position="sticky" top={0} bg="white" zIndex={1}>
                              <Table.Row>
                                <Table.ColumnHeader>Parameter Name</Table.ColumnHeader>
                                <Table.ColumnHeader>ID</Table.ColumnHeader>
                                <Table.ColumnHeader>Range</Table.ColumnHeader>
                                <Table.ColumnHeader>Type</Table.ColumnHeader>
                                <Table.ColumnHeader>Description</Table.ColumnHeader>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {filteredParameters.map((param) => {
                                const paramWithMeta = param as ModelParameter & {
                                  cdi3Source?: boolean;
                                  cdi3Description?: string;
                                  cdi3Category?: string;
                                };
                                
                                return (
                                  <Table.Row key={param.id}>
                                    <Table.Cell>
                                      <HStack>
                                        <Text fontWeight="medium">{param.name}</Text>
                                        {paramWithMeta.cdi3Source && (
                                          <Badge size="sm" colorScheme="purple">CDI3</Badge>
                                        )}
                                      </HStack>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text fontSize="xs" fontFamily="mono" color="gray.600">
                                        {param.id}
                                      </Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text fontSize="sm">
                                        {param.minValue.toFixed(1)} - {param.maxValue.toFixed(1)}
                                      </Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <VStack align="start" spacing={0}>
                                        {param.isExpressionParameter && (
                                          <Badge colorScheme="purple" size="sm">Expression</Badge>
                                        )}
                                        {paramWithMeta.cdi3Category && (
                                          <Badge colorScheme="blue" size="sm" variant="outline">
                                            {paramWithMeta.cdi3Category}
                                          </Badge>
                                        )}
                                      </VStack>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Text fontSize="sm" color="gray.600" noOfLines={2}>
                                        {paramWithMeta.cdi3Description || 'No description available'}
                                      </Text>
                                    </Table.Cell>
                                  </Table.Row>
                                );
                              })}
                            </Table.Body>
                          </Table.Root>
                        </Box>
                        
                        {filteredParameters.length === 0 && (searchQuery || selectedCategory !== 'All') && (
                          <Alert.Root status="info">
                            <Alert.Indicator>
                              <InfoIcon />
                            </Alert.Indicator>
                            <Alert.Description>
                              No parameters found matching your filters. Try adjusting the category or search terms.
                            </Alert.Description>
                          </Alert.Root>
                        )}
                      </VStack>
                    </Tabs.Content>
                  </Tabs.Root>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button onClick={onClose}>Close</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Create/Edit Expression Modal */}
      <Dialog.Root 
        open={isCreateModalOpen || isEditModalOpen} 
        onOpenChange={(details) => {
          if (!details.open) {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxWidth="6xl" maxHeight="90vh">
              <Dialog.Header>
                <Dialog.Title>
                  {selectedExpression ? 'Edit Expression' : 'Create Custom Expression'}
                </Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="sm">✕</Button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
                <VStack spacing={6} align="stretch">
                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <Alert.Root status="error">
                      <Alert.Indicator>
                        <InfoIcon />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Validation Errors</Alert.Title>
                        <Alert.Description>
                          <VStack align="start" spacing={1}>
                            {validationErrors.map((error, index) => (
                              <Text key={index} fontSize="sm">• {error}</Text>
                            ))}
                          </VStack>
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {/* Basic Information */}
                  <Card.Root>
                    <Card.Header>
                      <Heading size="sm">Expression Information</Heading>
                    </Card.Header>
                    <Card.Body>
                      <VStack spacing={4} align="stretch">
                        <Field.Root required invalid={validationErrors.some(e => e.includes('name'))}>
                          <Field.Label>Expression Name</Field.Label>
                          <Input 
                            placeholder="e.g., Happy, Sad, Surprised"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          />
                          <Field.HelperText>
                            This name will be used by the AI backend to trigger the expression
                          </Field.HelperText>
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Description</Field.Label>
                          <Textarea 
                            placeholder="Describe what this expression represents..."
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                          />
                        </Field.Root>
                      </VStack>
                    </Card.Body>
                  </Card.Root>

                  {/* Parameter Configuration */}
                  <Card.Root>
                    <Card.Header>
                      <HStack>
                        <Heading size="sm">Parameter Configuration</Heading>
                        <Spacer />
                        <Text fontSize="sm" color="gray.600">
                          {formData.parameters.length} parameters configured
                        </Text>
                      </HStack>
                    </Card.Header>
                    <Card.Body>
                      <VStack spacing={4} align="stretch">
                        {/* Add Parameter Section */}
                        <Box>
                          <Text fontSize="sm" mb={2} fontWeight="medium">Add Parameter</Text>
                          <VStack spacing={2} align="stretch">
                            <HStack>
                              <Field.Root width="200px">
                                <NativeSelect.Root 
                                  size="sm" 
                                  value={selectedCategory} 
                                  onValueChange={(details) => setSelectedCategory(details.value)}
                                >
                                  <NativeSelect.Field>
                                    {categories.map(category => (
                                      <option key={category} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </NativeSelect.Field>
                                  <NativeSelect.Indicator />
                                </NativeSelect.Root>
                              </Field.Root>
                              <Field.Root>
                                <Input 
                                  size="sm" 
                                  placeholder="Search parameters..." 
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                />
                              </Field.Root>
                            </HStack>
                            
                            <Box maxHeight="200px" overflowY="auto" border="1px" borderColor="gray.200" rounded="md">
                              {filteredParameters.map((param) => {
                                const isAlreadyAdded = formData.parameters.some(p => p.parameterId === param.id);
                                const paramWithMeta = param as ModelParameter & {
                                  cdi3Source?: boolean;
                                  cdi3Description?: string;
                                };
                                
                                return (
                                  <Flex 
                                    key={param.id} 
                                    p={3} 
                                    borderBottom="1px" 
                                    borderColor="gray.100"
                                    _hover={{ bg: 'gray.50' }}
                                  >
                                    <VStack align="start" spacing={1} flex={1}>
                                      <HStack>
                                        <Text fontSize="sm" fontWeight="medium">{param.name}</Text>
                                        {paramWithMeta.cdi3Source && (
                                          <Badge size="sm" colorScheme="purple">CDI3</Badge>
                                        )}
                                        {param.isExpressionParameter && (
                                          <Badge size="sm" colorScheme="blue">Expression</Badge>
                                        )}
                                      </HStack>
                                      <Text fontSize="xs" color="gray.600">{param.id}</Text>
                                      {paramWithMeta.cdi3Description && (
                                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                                          {paramWithMeta.cdi3Description}
                                        </Text>
                                      )}
                                    </VStack>
                                    <VStack align="end" spacing={1}>
                                      <Text fontSize="xs">
                                        {param.minValue.toFixed(1)} - {param.maxValue.toFixed(1)}
                                      </Text>
                                      <Button 
                                        size="xs" 
                                        onClick={() => addParameterToForm(param)}
                                        disabled={isAlreadyAdded}
                                        colorScheme={isAlreadyAdded ? 'gray' : 'blue'}
                                      >
                                        {isAlreadyAdded ? 'Added' : 'Add'}
                                      </Button>
                                    </VStack>
                                  </Flex>
                                );
                              })}
                            </Box>
                          </VStack>
                        </Box>

                        <Separator />

                        {/* Configured Parameters */}
                        <Box>
                          <Text fontSize="sm" mb={2} fontWeight="medium">Configured Parameters</Text>
                          {formData.parameters.length === 0 ? (
                            <Alert.Root status="info" size="sm">
                              <Alert.Indicator>
                                <InfoIcon />
                              </Alert.Indicator>
                              <Alert.Description>
                                Add parameters above to configure this expression
                              </Alert.Description>
                            </Alert.Root>
                          ) : (
                            <VStack spacing={3} align="stretch">
                              {formData.parameters.map((param, index) => (
                                <Card.Root key={param.parameterId} size="sm" variant="outline">
                                  <Card.Body>
                                    <VStack spacing={3} align="stretch">
                                      <HStack>
                                        <VStack align="start" spacing={0} flex={1}>
                                          <Text fontSize="sm" fontWeight="medium">{param.parameterName}</Text>
                                          <Text fontSize="xs" color="gray.600">{param.parameterId}</Text>
                                        </VStack>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          colorScheme="red"
                                          onClick={() => removeParameterFromForm(index)}
                                        >
                                          <DeleteIcon />
                                        </Button>
                                      </HStack>
                                      
                                      <HStack spacing={4}>
                                        <Field.Root>
                                          <Field.Label fontSize="xs">Target Value</Field.Label>
                                          <Input
                                            type="number"
                                            size="sm" 
                                            value={param.targetValue.toString()}
                                            onChange={(e) => updateParameterInForm(index, { targetValue: parseFloat(e.target.value) || 0 })}
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            bg="gray.700"
                                            border="1px solid"
                                            borderColor="gray.600"
                                            _focus={{
                                              borderColor: "blue.400",
                                              boxShadow: "0 0 0 1px blue.400",
                                            }}
                                          />
                                        </Field.Root>

                                        <Field.Root>
                                          <Field.Label fontSize="xs">Weight</Field.Label>
                                          <Input
                                            type="number"
                                            size="sm" 
                                            value={param.weight.toString()}
                                            onChange={(e) => updateParameterInForm(index, { weight: parseFloat(e.target.value) || 0 })}
                                            min={0}
                                            max={1}
                                            step={0.1}
                                            bg="gray.700"
                                            border="1px solid"
                                            borderColor="gray.600"
                                            _focus={{
                                              borderColor: "blue.400",
                                              boxShadow: "0 0 0 1px blue.400",
                                            }}
                                          />
                                        </Field.Root>

                                        <Field.Root>
                                          <Field.Label fontSize="xs">Blend Mode</Field.Label>
                                          <NativeSelect.Root 
                                            size="sm" 
                                            value={param.blendMode}
                                            onValueChange={(details) => updateParameterInForm(index, { blendMode: details.value as any })}
                                          >
                                            <NativeSelect.Field
                                              bg="gray.700"
                                              border="1px solid"
                                              borderColor="gray.600"
                                              _focus={{
                                                borderColor: "blue.400",
                                                boxShadow: "0 0 0 1px blue.400",
                                              }}
                                            >
                                              <option value="overwrite">Overwrite</option>
                                              <option value="add">Add</option>
                                              <option value="multiply">Multiply</option>
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                          </NativeSelect.Root>
                                        </Field.Root>
                                      </HStack>
                                    </VStack>
                                  </Card.Body>
                                </Card.Root>
                              ))}
                            </VStack>
                          )}
                        </Box>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <HStack>
                  <Button variant="ghost" onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    colorScheme="blue" 
                    onClick={handleSaveExpression}
                    disabled={!formData.name.trim() || formData.parameters.length === 0}
                  >
                    {selectedExpression ? 'Update Expression' : 'Create Expression'}
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Statistics Modal */}
      <Dialog.Root open={isStatsModalOpen} onOpenChange={(details) => !details.open && setIsStatsModalOpen(false)}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content maxWidth="lg">
              <Dialog.Header>
                <Dialog.Title>Model Statistics</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="sm">✕</Button>
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                {stats && (
                  <VStack spacing={4} align="stretch">
                    <Card.Root>
                      <Card.Header>
                        <Heading size="sm">Parameter Overview</Heading>
                      </Card.Header>
                      <Card.Body>
                        <VStack spacing={3} align="stretch">
                          <HStack justify="space-between">
                            <Text>Total Parameters:</Text>
                            <Badge>{stats.total}</Badge>
                          </HStack>
                          <HStack justify="space-between">
                            <Text>Expression-Related:</Text>
                            <Badge colorScheme="purple">{stats.expressionRelated}</Badge>
                          </HStack>
                          {stats.cdi3Enhanced && (
                            <HStack justify="space-between">
                              <Text>CDI3 Enhanced:</Text>
                              <Badge colorScheme="green">Yes</Badge>
                            </HStack>
                          )}
                        </VStack>
                      </Card.Body>
                    </Card.Root>

                    <Card.Root>
                      <Card.Header>
                        <Heading size="sm">Custom Expressions</Heading>
                      </Card.Header>
                      <Card.Body>
                        <VStack spacing={3} align="stretch">
                          <HStack justify="space-between">
                            <Text>Total Expressions:</Text>
                            <Badge>{stats.customExpressions}</Badge>
                          </HStack>
                          <HStack justify="space-between">
                            <Text>Enabled Expressions:</Text>
                            <Badge colorScheme="green">{stats.enabledExpressions}</Badge>
                          </HStack>
                        </VStack>
                      </Card.Body>
                    </Card.Root>

                    {Object.keys(categorizedParameters).length > 0 && (
                      <Card.Root>
                        <Card.Header>
                          <Heading size="sm">Parameter Categories</Heading>
                        </Card.Header>
                        <Card.Body>
                          <VStack spacing={2} align="stretch">
                            {Object.entries(categorizedParameters).map(([category, params]) => (
                              <HStack key={category} justify="space-between">
                                <Text>{category}:</Text>
                                <Badge variant="outline">{params.length}</Badge>
                              </HStack>
                            ))}
                          </VStack>
                        </Card.Body>
                      </Card.Root>
                    )}
                  </VStack>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button onClick={() => setIsStatsModalOpen(false)}>Close</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
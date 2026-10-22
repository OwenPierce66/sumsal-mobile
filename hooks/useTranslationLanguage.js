/**
 * "Mi idioma" del traductor de mensajes.
 * GET/PATCH `massaging/translation/language/` (el idioma vive en el perfil).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export const TRANSLATION_LANGUAGE_KEY = ['translationLanguage'];

const ENDPOINT = 'massaging/translation/language/';

export const useTranslationLanguage = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TRANSLATION_LANGUAGE_KEY,
    queryFn: async () => (await api.get(ENDPOINT)).data,
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (language) => (await api.patch(ENDPOINT, { language })).data,
    onSuccess: (data) => queryClient.setQueryData(TRANSLATION_LANGUAGE_KEY, data),
  });

  return {
    language: query.data?.language || 'es',
    supported: query.data?.supported || [],
    configured: query.data ? query.data.configured !== false : true,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    setLanguage: mutation.mutateAsync,
    isSaving: mutation.isPending ?? mutation.isLoading,
  };
};

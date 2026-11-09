import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { NoteVersion } from '../db/schema'

export function useNoteVersions(noteId?: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['note_versions', noteId],
    enabled: !!user && !!noteId,
    queryFn: async () => {
      if (!noteId) return []
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[useNoteVersions] Error fetching note versions:', error.message)
        return []
      }

      return (data ?? []) as NoteVersion[]
    },
  })
}


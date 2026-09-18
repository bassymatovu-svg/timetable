// Supabase Edge Function: process-import
// Uses Google Gemini API (gemini-2.5-flash) with structured JSON responseSchema
// Parses uploaded curriculum spreadsheets or legacy timetable schedules

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface RequestBody {
  mode: "curriculum_list" | "legacy_timetable"
  rawText?: string
  fileBase64?: string
  mimeType?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { mode, rawText, fileBase64, mimeType }: RequestBody = await req.json()
    const apiKey = Deno.env.get("GEMINI_API_KEY")

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured in Supabase Edge Function environment.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    // Define strict response schema based on import mode
    const responseSchema = {
      type: "ARRAY",
      description: "List of extracted lesson or curriculum requirement rows",
      items: {
        type: "OBJECT",
        properties: {
          className: { type: "STRING", description: "Class or cohort name, e.g. Grade 10B" },
          subjectName: { type: "STRING", description: "Subject title, e.g. Mathematics" },
          teacherName: { type: "STRING", description: "Teacher or instructor full name" },
          roomName: { type: "STRING", description: "Room or lab name, e.g. Room 101" },
          dayOfWeek: { type: "INTEGER", description: "1 for Monday through 5 for Friday (legacy timetable only)" },
          periodNumber: { type: "INTEGER", description: "Period slot number 1-7 (legacy timetable only)" },
          periodsPerWeek: { type: "INTEGER", description: "Total periods per week (curriculum import only)" },
        },
        required: ["className", "subjectName"],
      },
    }

    const promptText =
      mode === "curriculum_list"
        ? "Extract all curriculum requirements from the provided document. Identify the class cohort, subject name, teacher name if specified, and number of periods per week."
        : "Extract all scheduled lessons from the legacy timetable schedule. Identify the day of week (1=Mon to 5=Fri), period number (1 to 7), class name, subject name, teacher name, and room."

    const contents: any[] = []
    const parts: any[] = [{ text: promptText }]

    if (rawText) {
      parts.push({ text: `\n\n--- DOCUMENT DATA ---\n${rawText}` })
    } else if (fileBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType,
          data: fileBase64,
        },
      })
    }

    contents.push({ role: "user", parts })

    const geminiPayload = {
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
      },
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      throw new Error(`Gemini API error (${resp.status}): ${errBody}`)
    }

    const geminiData = await resp.json()
    const extractedJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    const extractedRows = extractedJsonText ? JSON.parse(extractedJsonText) : []

    return new Response(
      JSON.stringify({
        success: true,
        extractedCount: extractedRows.length,
        rows: extractedRows,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

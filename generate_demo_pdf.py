"""
PurposeCanvas -- Comprehensive Demo PDF Generator
10 educational points across ALL 4 image types with varying complexity.
Run: python generate_demo_pdf.py
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos

pdf = FPDF()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

# ── Title ─────────────────────────────────────────────────────────────────────
pdf.set_font("Helvetica", style="B", size=18)
pdf.cell(0, 12, text="Class 6 Complete Science Lesson Plan", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

pdf.set_font("Helvetica", style="I", size=10)
pdf.set_text_color(80, 80, 80)
pdf.cell(0, 7, text="Biology | Astronomy | Ecology  |  Grade 5-7  |  Age 10-13  |  10 Illustration Requests", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
pdf.set_text_color(0, 0, 0)
pdf.ln(5)

# ── SECTION A: COLOURING / OUTLINE (bw, printable) ───────────────────────────
def section_header(title, r, g, b):
    pdf.set_fill_color(r, g, b)
    pdf.set_font("Helvetica", style="B", size=12)
    pdf.cell(0, 9, text=title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
    pdf.ln(2)

def point(text):
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 8, text=text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

section_header("Section A: Colouring Page Outlines  [Black & White, Print-ready]", 210, 230, 255)

point("1. Outline a detailed human digestive system diagram for Class 6 Biology showing mouth, oesophagus, stomach, small intestine, large intestine, and liver with empty label boxes for students to fill in")

point("2. Draw a life cycle of a butterfly outline illustration showing all four stages: egg on leaf, caterpillar eating leaf, chrysalis hanging from branch, and fully formed adult butterfly with patterned wings -- thick clean lines for colouring")

point("3. Sketch a cross-section of a plant cell outline showing the nucleus, cell wall, cell membrane, chloroplasts, mitochondria, vacuole, and endoplasmic reticulum with connecting arrows and blank label lines")

pdf.ln(3)
section_header("Section B: Educational Flashcard Illustrations  [Bright Colour, Screen & Print]", 210, 255, 210)

point("4. Photosynthesis process flashcard illustration: a bright colourful diagram of a sunlit green leaf with arrows showing sunlight energy in, water absorbed through roots, carbon dioxide entering through stomata, glucose stored in leaf, and oxygen released -- flat vector style educational flashcard")

point("5. Water cycle complete flashcard: vibrant illustration showing the full water cycle with a blue ocean, evaporation arrows rising, white clouds forming through condensation, rain precipitation falling on mountains, rivers flowing back to ocean, and underground water table -- educational diagram style")

point("6. Forest food chain flashcard: bright educational illustration of a complete food chain showing grass at the bottom, grasshopper eating grass, green frog eating grasshopper, garden snake eating frog, and eagle at the top -- labelled with Producer, Primary Consumer, Secondary Consumer, Tertiary Consumer, Apex Predator")

pdf.ln(3)
section_header("Section C: High-Resolution Classroom Poster Illustrations  [Full Colour, A2 Print Quality]", 255, 240, 200)

point("7. Solar system vibrant classroom poster: spectacular full-colour illustration of all eight planets orbiting the sun in correct order -- Mercury, Venus, Earth, Mars, Jupiter with Great Red Spot, Saturn with detailed ring system, Uranus, and Neptune -- with asteroid belt, accurate relative sizes, and planet name labels on dark space background with stars and nebula")

point("8. Endangered animals of India conservation poster: dramatic colourful illustration featuring Bengal tiger in tall grass, Asiatic lion on rocky outcrop, snow leopard on Himalayan mountain, Indian one-horned rhinoceros in wetland, and Gangetic river dolphin -- with habitat backgrounds and conservation status labels -- professional classroom display quality")

pdf.ln(3)
section_header("Section D: Printable Fill-in Worksheet Illustrations  [Black & White, Exercise Format]", 255, 215, 215)

point("9. Human skeleton worksheet diagram: clean black and white anatomical illustration of a full human skeleton with 15 numbered blank label lines pointing to: skull, mandible, clavicle, ribcage, sternum, humerus, radius, ulna, spine, pelvis, femur, patella, tibia, fibula, and foot bones -- exercise format for students to write in bone names")

point("10. Weather symbols worksheet chart: black and white printable exercise sheet with 8 weather condition illustrations -- sunny with rays, partly cloudy, overcast, light rain, heavy storm with lightning, snow, windy with leaves blowing, and foggy -- each with a blank line for students to write the weather name and a temperature range box")

pdf.ln(5)

# ── Footer ────────────────────────────────────────────────────────────────────
pdf.set_font("Helvetica", style="I", size=8)
pdf.set_text_color(120, 120, 120)
pdf.cell(0, 6, text="PurposeCanvas Demo -- 10 Illustration Requests | 3 Outline | 3 Flashcard | 2 Poster | 2 Worksheet | RAG Pipeline Test Document", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

out = "demo_class6_lesson_plan.pdf"
pdf.output(out)
print(f"Generated: {out}")
print()
print("10 points breakdown:")
print("  [bw  / outline  / complexity 2] 1. Human digestive system")
print("  [bw  / outline  / complexity 2] 2. Butterfly life cycle")
print("  [bw  / outline  / complexity 3] 3. Plant cell cross-section")
print("  [col / flashcard/ complexity 2] 4. Photosynthesis process")
print("  [col / flashcard/ complexity 2] 5. Water cycle diagram")
print("  [col / flashcard/ complexity 2] 6. Forest food chain")
print("  [col / poster   / complexity 3] 7. Solar system poster")
print("  [col / poster   / complexity 3] 8. Endangered animals poster")
print("  [bw  / worksheet/ complexity 3] 9. Human skeleton worksheet")
print("  [bw  / worksheet/ complexity 2] 10. Weather symbols worksheet")

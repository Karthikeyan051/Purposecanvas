from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=15)
pdf.cell(200, 10, text="Class 4 Geography: The Solar System", ln=1, align='C')
pdf.set_font("Arial", size=12)

content = """
Introduction to our Solar System

Here are the main components we need to study:

1) The Sun - The star at the center of our solar system, providing light and heat.
2) Mercury and Venus - The innermost rocky planets.
3) Earth - Our home planet, known for liquid water and life.
4) Mars - The red planet with polar ice caps.
5) Gas Giants - Jupiter and Saturn, massive planets with rings and many moons.
6) Ice Giants - Uranus and Neptune, the furthest planets in the solar system.
7) Asteroid Belt - A region of space rock between Mars and Jupiter.
"""

for line in content.split('\n'):
    pdf.cell(200, 10, text=line, ln=1, align='L')

pdf.output("solar_system_lesson_plan.pdf")
print("PDF created successfully!")

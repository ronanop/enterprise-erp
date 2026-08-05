def calculate_grade(assignments, quizzes, midterm, final_exam):
    weighted_score = (
        assignments * 0.25
        + quizzes * 0.20
        + midterm * 0.25
        + final_exam * 0.30
    )

    if weighted_score >= 90:
        return "A"
    elif weighted_score >= 80:
        return "B"
    elif weighted_score >= 70:
        return "C"
    elif weighted_score >= 60:
        return "D"
    else:
        return "F"


def get_score(message):
    while True:
        try:
            score = float(input(message))
            if 0 <= score <= 100:
                return score
            else:
                print("Enter marks between 0 and 100.")
        except ValueError:
            print("Invalid input. Please enter a number.")


def main():
    print("--- Student Grade Calculator ---")

    print("\nEnter Student Details:")
    name = input("Name: ")
    roll_number = input("Roll Number: ")

    while True:
        try:
            age = int(input("Age: "))
            if age > 0:
                break
            else:
                print("Age must be greater than 0.")
        except ValueError:
            print("Please enter a valid age.")

    print("\nEnter Course Components Scores:")
    assignments = get_score("Assignments: ")
    quizzes = get_score("Quizzes: ")
    midterm = get_score("Midterm Exam: ")
    final_exam = get_score("Final Exam: ")

    final_grade = calculate_grade(assignments, quizzes, midterm, final_exam)

    print("\n--- Result ---")
    print("Name:", name)
    print("Roll Number:", roll_number)
    print("Age:", age)
    print("Final Grade:", final_grade)


if __name__ == "__main__":
    main()
from .schemas import Problem, TestCase


PROBLEMS: dict[str, Problem] = {
    "list-sum": Problem(
        id="list-sum",
        title="計算串列總和",
        difficulty="beginner",
        estimated_minutes=8,
        concepts=["loop", "accumulator", "list", "function"],
        description="使用迴圈計算串列中所有數字的總和，不可使用 sum()。",
        function_name="calculate_sum",
        parameters=["numbers"],
        starter_code=(
            "def calculate_sum(numbers):\n"
            "    total = 0\n"
            "    for number in numbers:\n"
            "        total = number\n"
            "    return total"
        ),
        sample_input="[4, 7, 2]",
        sample_output="13",
        required_structures=["For", "Return"],
        forbidden_calls=["sum"],
        tests=[
            TestCase(name="一般案例", args=[[1, 2, 3]], expected=6),
            TestCase(name="單一元素", args=[[9]], expected=9),
            TestCase(name="空串列", args=[[]], expected=0, kind="boundary"),
            TestCase(name="負數", args=[[-2, 5, -7]], expected=-4, kind="hidden"),
        ],
    ),
    "even-check": Problem(
        id="even-check",
        title="判斷偶數",
        difficulty="beginner",
        estimated_minutes=6,
        concepts=["condition", "function"],
        description="偶數回傳 True，奇數回傳 False。",
        function_name="is_even",
        parameters=["number"],
        starter_code=(
            "def is_even(number):\n"
            "    if number % 2 == 1:\n"
            "        return True\n"
            "    return False"
        ),
        sample_input="8",
        sample_output="True",
        required_structures=["Return"],
        tests=[
            TestCase(name="正偶數", args=[8], expected=True),
            TestCase(name="正奇數", args=[7], expected=False),
            TestCase(name="零", args=[0], expected=True, kind="boundary"),
            TestCase(name="負偶數", args=[-6], expected=True, kind="hidden"),
        ],
    ),
    "find-max": Problem(
        id="find-max",
        title="找出最大值",
        difficulty="intermediate",
        estimated_minutes=10,
        concepts=["loop", "condition", "list"],
        description="不用 max() 找出非空串列的最大值；輸入可能全部是負數。",
        function_name="find_max",
        parameters=["numbers"],
        starter_code=(
            "def find_max(numbers):\n"
            "    largest = 0\n"
            "    for number in numbers:\n"
            "        if number > largest:\n"
            "            largest = number\n"
            "    return largest"
        ),
        sample_input="[-8, -3, -11]",
        sample_output="-3",
        required_structures=["For", "If", "Return"],
        forbidden_calls=["max"],
        tests=[
            TestCase(name="一般案例", args=[[4, 9, 2]], expected=9),
            TestCase(name="全為負數", args=[[-8, -3, -11]], expected=-3, kind="boundary"),
            TestCase(name="單一元素", args=[[-5]], expected=-5, kind="boundary"),
            TestCase(name="隱藏案例", args=[[12, 12, 3]], expected=12, kind="hidden"),
        ],
    ),
}


def list_problems() -> list[Problem]:
    return list(PROBLEMS.values())


def get_problem(problem_id: str) -> Problem | None:
    return PROBLEMS.get(problem_id)


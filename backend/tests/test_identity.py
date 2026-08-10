"""身份匹配引擎测试：邮箱 / 工号 / 姓名 / 拼音。"""
from app.identity_matcher import match_git_contributor


class FakeDev:
    def __init__(self, id, name, email=None, employee_id=None, team="平台组", commits=0, username=None):
        self.id = id
        self.name = name
        self.email = email
        self.employee_id = employee_id
        self.team = team
        self.commits = commits
        self.username = username


class FakeUser:
    def __init__(self, email, username=None, name=None):
        self.email = email
        self.username = username
        self.name = name


def test_email_exact_match():
    devs = [FakeDev("d1", "张三", email="zhangsan@example.com", employee_id="E001")]
    result = match_git_contributor("ZhangSan", "zhangsan@example.com", devs, [])
    assert result.method == "email"
    assert result.developer_id == "d1"
    assert result.confidence >= 0.9


def test_account_user_email_fallback():
    devs = [FakeDev("d1", "张三", username="zhangsan")]
    users = [FakeUser("zhangsan@example.com", username="zhangsan", name="张三")]
    result = match_git_contributor("Zhang San", "zhangsan@example.com", devs, users)
    assert result.method == "email"
    assert result.developer_id == "d1"


def test_employee_id_in_email():
    devs = [FakeDev("d1", "李四", employee_id="E042")]
    result = match_git_contributor("李四", "e042@company.com", devs, [])
    assert result.method == "employee_id"
    assert result.developer_id == "d1"


def test_exact_name_match():
    devs = [FakeDev("d1", "王五", email="wangwu@example.com")]
    result = match_git_contributor("王五", "unrelated@example.com", devs, [])
    assert result.method == "exact"
    assert result.developer_id == "d1"


def test_pinyin_match():
    devs = [FakeDev("d1", "张三")]
    result = match_git_contributor("zhangsan", "", devs, [])
    assert result.method == "pinyin"
    assert result.developer_id == "d1"


def test_fuzzy_fallback():
    devs = [FakeDev("d1", "李四")]
    result = match_git_contributor("unknown-person-xyz", "", devs, [])
    assert result.method == "fuzzy"
    assert result.developer_id is None

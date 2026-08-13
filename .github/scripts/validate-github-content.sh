#!/usr/bin/env bash

set -u

mode="${1:-}"
title="${TITLE:-}"
body="${BODY:-}"
errors=()

contains_korean() {
  perl -CS -e 'my $text = do { local $/; <STDIN> }; exit($text =~ /[\x{AC00}-\x{D7A3}]/ ? 0 : 1)' <<< "$1"
}

if [[ "$mode" == "pr" ]]; then
  title_pattern='^(feat|fix|docs|test|refactor|perf|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .+$'

  if [[ ! "$title" =~ $title_pattern ]] || ! contains_korean "$title"; then
    errors+=("PR 제목은 '<type>(<scope>): <한글 설명>' 형식이어야 합니다.")
  fi

  for heading in '## 개요' '## 주요 변경 사항' '## 변경 파일' '## 검증' '## 영향' '## 관련 이슈'; do
    if ! grep -Fq -- "$heading" <<< "$body"; then
      errors+=("PR 본문에 '$heading' 섹션이 필요합니다.")
    fi
  done

  if ! grep -Eq '(Closes|Fixes|Resolves|Refs) #[0-9]+' <<< "$body"; then
    errors+=("PR 본문에 'Closes #번호' 또는 'Refs #번호' 형식의 이슈 연결이 필요합니다.")
  fi
elif [[ "$mode" == "issue" ]]; then
  if [[ "$title" == "[이슈]" || "$title" == "[이슈] " ]] || ! contains_korean "$title"; then
    errors+=("이슈 제목에 한글 설명을 작성해야 합니다.")
  fi

  if ! contains_korean "$body"; then
    errors+=("이슈 본문에 한글 설명을 작성해야 합니다.")
  fi
else
  echo "사용법: $0 pr|issue" >&2
  exit 2
fi

if ((${#errors[@]} > 0)); then
  printf '::error::%s\n' "${errors[@]}"
  exit 1
fi

echo "한글 이슈·PR 문구 컨벤션을 통과했습니다."
